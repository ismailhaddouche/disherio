import express from 'express';
const router = express.Router();
import Joi from 'joi';
import multer from 'multer';
import { verifyToken } from '../middleware/auth.middleware.js';
import { validate, mongoIdSchema, restaurantUpdateSchema } from '../middleware/validation.middleware.js';
import { ROLES } from '../constants.js';
import restaurantController from '../controllers/restaurant.controller.js';

// Middleware to ensure admin role
async function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== ROLES.ADMIN) {
        return res.error(req.t('ERRORS.ACCESS_DENIED_ADMIN'), 403);
    }
    next();
}

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

// ── Joi Schemas ──────────────────────────────────────────────────────────────

const totemSchema = Joi.object({
    name: Joi.string().required().min(1).max(50).trim(),
    isVirtual: Joi.boolean().default(false)
}).unknown(false);

const logSchema = Joi.object({
    action: Joi.string().required().max(100).trim(),
    userId: Joi.string().required().max(100).trim(),
    username: Joi.string().max(100).optional().trim(),
    role: Joi.string().max(50).optional().trim(),
    details: Joi.object().optional(),
    tableNumber: Joi.string().max(20).optional()
}).unknown(false);

// ── Routes ───────────────────────────────────────────────────────────────────

router.get('/restaurant', restaurantController.getRestaurant);
router.patch('/restaurant', verifyToken, requireAdmin, validate(restaurantUpdateSchema), restaurantController.updateRestaurant);
router.post('/upload-logo', verifyToken, requireAdmin, upload.single('logo'), restaurantController.uploadLogo);

router.get('/totems/:id/session', validate(Joi.object({ id: Joi.number().integer().required() }), 'params'), restaurantController.getTotemSession);
router.post('/totems/:id/session', validate(Joi.object({ id: Joi.number().integer().required() }), 'params'), restaurantController.startTotemSession);

router.get('/totems', restaurantController.getTotems);
router.post('/totems', verifyToken, validate(totemSchema), restaurantController.addTotem);
router.patch('/totems/:id', verifyToken, requireAdmin, validate(Joi.object({ id: Joi.string().required() }), 'params'), validate(totemSchema), restaurantController.updateTotem);
router.delete('/totems/:id', verifyToken, validate(Joi.object({ id: Joi.string().required() }), 'params'), restaurantController.deleteTotem);

router.get('/qr/:totemId', validate(Joi.object({ totemId: Joi.string().required() }), 'params'), restaurantController.getQr);

router.post('/close-shift', verifyToken, requireAdmin, restaurantController.closeShift);

router.post('/logs', verifyToken, validate(logSchema), restaurantController.createLog);
router.get('/logs', verifyToken, requireAdmin, restaurantController.getLogs);

router.get('/history', verifyToken, restaurantController.getHistory);
router.delete('/tickets/:ticketId', verifyToken, validate(mongoIdSchema.rename('id', 'ticketId'), 'params'), restaurantController.deleteTicket);

export default router;
