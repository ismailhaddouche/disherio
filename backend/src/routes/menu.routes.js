import express from 'express';
import Joi from 'joi';
const router = express.Router();
import MenuItem from '../models/MenuItem.js';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';
import { validate, menuItemSchema, mongoIdSchema } from '../middleware/validation.middleware.js';
import multer from 'multer';
import { ROLES } from '../constants.js';
import menuController from '../controllers/menu.controller.js';

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
    if (req.user.role === ROLES.ADMIN) return next();

    if (req.user.role === ROLES.KITCHEN) {
        try {
            const category = req.body.category || (req.params.id ? (await MenuItem.findById(req.params.id))?.category : null);
            if (category === 'Fuera de Carta') {
                return next();
            }
        } catch (err) {
            return next(err);
        }
        return res.error(req.t('ERRORS.KITCHEN_CATEGORY_RESTRICTED'), 403);
    }

    res.error(req.t('ERRORS.ACCESS_DENIED_ROLE'), 403);
}

// Routes
router.get('/', menuController.getAll);
router.post('/upload-image', verifyToken, requireRole(ROLES.KITCHEN), upload.single('image'), menuController.uploadImage);
router.post('/', verifyToken, authorizeKitchenAction, validate(menuItemSchema), menuController.createOrUpdate);
router.delete('/:id', verifyToken, authorizeKitchenAction, validate(mongoIdSchema, 'params'), menuController.delete);

router.post('/:productId/toggle',
    verifyToken,
    validate(Joi.object({ productId: Joi.string().hex().length(24).required() }).unknown(false), 'params'),
    async function(req, res, next) {
        if ([ROLES.ADMIN, ROLES.KITCHEN].includes(req.user.role)) return next();
        res.error(req.t('ERRORS.ACCESS_DENIED_ROLE'), 403);
    },
    menuController.toggleAvailability
);

export default router;
