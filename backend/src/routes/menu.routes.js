import express from 'express';
import Joi from 'joi';
const router = express.Router();
import MenuItem from '../models/MenuItem.js';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';
import { validate, menuItemSchema, mongoIdSchema } from '../middleware/validation.middleware.js';
import MenuService from '../services/menu.service.js';
import AuditService from '../services/audit.service.js';
import multer from 'multer';

// Configure multer storage (memory storage for sharp processing)
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Solo se permiten imágenes'));
    }
});

// Middleware to restrict certain actions to admin OR kitchen (for specific categories)
async function authorizeKitchenAction(req, res, next) {
    if (req.user.role === 'admin') return next();

    if (req.user.role === 'kitchen') {
        const category = req.body.category || (req.params.id ? (await MenuItem.findById(req.params.id))?.category : null);
        if (category === 'Fuera de Carta') {
            return next();
        }
        return res.error('La cocina solo puede gestionar platos "Fuera de Carta"', 403);
    }

    res.error('Acceso denegado', 403);
}

// GET / - List all menu items
router.get('/', async function(req, res) {
    const items = await MenuItem.find().sort({ category: 1, order: 1, name: 1 });
    res.success(items);
});

// POST /upload-image - Upload and optimize menu item image
router.post('/upload-image', verifyToken, requireRole('kitchen'), upload.single('image'), async function(req, res) {
    if (!req.file) return res.error('No se proporcionó ninguna imagen', 400);

    try {
        const fileUrl = await MenuService.processImage(req.file.buffer);
        
        await AuditService.log(req, 'MENU_ITEM_IMAGE_UPLOADED', {
            url: fileUrl,
            originalName: req.file.originalname
        });

        res.success({ url: fileUrl });
    } catch (error) {
        console.error('Error processing image:', error);
        res.error('Error al procesar la imagen', 500);
    }
});

// POST / - Create or update a menu item
router.post('/',
    verifyToken,
    authorizeKitchenAction,
    validate(menuItemSchema),
    async function(req, res) {
        const { _id, ...data } = req.body;

        let item;
        if (_id) {
            if (req.user.role === 'kitchen' && data.category !== 'Fuera de Carta') {
                return res.error('La cocina no puede mover platos fuera de "Fuera de Carta"', 403);
            }

            const oldItem = await MenuItem.findById(_id);
            item = await MenuItem.findByIdAndUpdate(_id, data, { new: true });
            
            if (!item) {
                return res.error('Menu item not found', 404);
            }

            await AuditService.logChange(req, 'MENU_ITEM_UPDATED', oldItem?.toObject(), item.toObject(), {
                itemId: item._id,
                itemName: item.name
            });
        } else {
            item = new MenuItem(data);
            await item.save();
            await AuditService.log(req, 'MENU_ITEM_CREATED', {
                itemId: item._id,
                itemName: item.name,
                category: item.category
            });
        }

        const io = req.app.get('io');
        if (io) {
            io.emit('menu-update', item);
        }

        res.success(item);
    }
);

// DELETE /:id - Delete a menu item
router.delete('/:id',
    verifyToken,
    authorizeKitchenAction,
    validate(mongoIdSchema, 'params'),
    async function(req, res) {
        const item = await MenuItem.findByIdAndDelete(req.params.id);
        if (!item) {
            return res.error('Menu item not found', 404);
        }

        await AuditService.log(req, 'MENU_ITEM_DELETED', {
            itemId: item._id,
            itemName: item.name
        });

        const io = req.app.get('io');
        if (io) {
            io.emit('menu-update', { deleted: item._id });
        }

        res.success({ message: 'Menu item deleted' });
    }
);

// POST /:productId/toggle - Toggle item availability
router.post('/:productId/toggle',
    verifyToken,
    validate(Joi.object({ productId: Joi.string().hex().length(24).required() }).unknown(false), 'params'),
    async function(req, res, next) {
        if (['admin', 'kitchen'].includes(req.user.role)) return next();
        res.error('Solo administración o cocina pueden cambiar la disponibilidad', 403);
    },
    async function(req, res) {
        const item = await MenuItem.findById(req.params.productId);
        if (!item) {
            return res.error('Menu item not found', 404);
        }

        const previousStatus = item.available;
        item.available = !item.available;
        await item.save();

        await AuditService.log(req, 'MENU_ITEM_AVAILABILITY_TOGGLED', {
            itemId: item._id,
            itemName: item.name,
            from: previousStatus,
            to: item.available
        });

        const io = req.app.get('io');
        if (io) {
            io.emit('menu-update', item);
        }

        res.success(item);
    }
);

export default router;
