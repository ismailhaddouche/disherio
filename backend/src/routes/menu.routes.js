import express from 'express';
const router = express.Router();
import MenuItem from '../models/MenuItem.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { validate, menuItemSchema } from '../middleware/validation.middleware.js';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
const authorizeKitchenAction = async (req, res, next) => {
    if (req.user.role === 'admin') return next();

    if (req.user.role === 'kitchen') {
        const category = req.body.category || (req.params.id ? (await MenuItem.findById(req.params.id))?.category : null);
        if (category === 'Fuera de Carta') {
            return next();
        }
        return res.error('La cocina solo puede gestionar platos "Fuera de Carta"', 403);
    }

    res.error('Acceso denegado', 403);
};

// GET / - List all menu items
router.get('/', async (req, res) => {
    const items = await MenuItem.find().sort({ category: 1, order: 1, name: 1 });
    res.success(items);
});

// POST /upload-image - Upload and optimize menu item image
router.post('/upload-image', verifyToken, authorizeKitchenAction, upload.single('image'), async (req, res) => {
    if (!req.file) return res.error('No se proporcionó ninguna imagen', 400);

    const uploadDir = path.join(__dirname, '../../public/uploads/menu');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const filename = `item-${Date.now()}-${Math.round(Math.random() * 1000)}.webp`;
    const filepath = path.join(uploadDir, filename);

    // Optimize image with sharp: Max 500px, WebP format
    await sharp(req.file.buffer)
        .resize(500, 500, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(filepath);

    const fileUrl = `/uploads/menu/${filename}`;
    res.success({ url: fileUrl });
});

// POST / - Create or update a menu item
router.post('/',
    verifyToken,
    authorizeKitchenAction,
    validate(menuItemSchema),
    async (req, res) => {
        const { _id, ...data } = req.body;

        let item;
        if (_id) {
            if (req.user.role === 'kitchen' && data.category !== 'Fuera de Carta') {
                return res.error('La cocina no puede mover platos fuera de "Fuera de Carta"', 403);
            }

            item = await MenuItem.findByIdAndUpdate(_id, data, { new: true });
            if (!item) {
                return res.error('Menu item not found', 404);
            }
        } else {
            item = new MenuItem(data);
            await item.save();
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
    async (req, res) => {
        const item = await MenuItem.findByIdAndDelete(req.params.id);
        if (!item) {
            return res.error('Menu item not found', 404);
        }

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
    async (req, res, next) => {
        if (['admin', 'kitchen'].includes(req.user.role)) return next();
        res.error('Solo administración o cocina pueden cambiar la disponibilidad', 403);
    },
    async (req, res) => {
        const item = await MenuItem.findById(req.params.productId);
        if (!item) {
            return res.error('Menu item not found', 404);
        }

        item.available = !item.available;
        await item.save();

        const io = req.app.get('io');
        if (io) {
            io.emit('menu-update', item);
        }

        res.success(item);
    }
);

export default router;
