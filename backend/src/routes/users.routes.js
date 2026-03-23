import express from 'express';
const router = express.Router();
import Joi from 'joi';
import { verifyToken } from '../middleware/auth.middleware.js';
import { validate, mongoIdSchema } from '../middleware/validation.middleware.js';
import { ROLES } from '../constants.js';
import userController from '../controllers/user.controller.js';

// ── Joi Schemas ──────────────────────────────────────────────────────────────

const userProfileSchema = Joi.object({
    username: Joi.string().min(3).max(50).trim().optional(),
    password: Joi.string().min(8).max(100).optional()
}).min(1);

const userAdminSchema = Joi.object({
    _id: Joi.string().hex().length(24).optional(),
    username: Joi.string().required().min(3).max(50).trim(),
    role: Joi.string().valid(...Object.values(ROLES)).required(),
    password: Joi.string().min(8).max(100).optional(),
    restaurantSlug: Joi.string().max(100).optional(),
    printerId: Joi.string().max(100).optional(),
    printTemplate: Joi.object().optional(),
    active: Joi.boolean().optional()
}).unknown(false);

const printSettingsSchema = Joi.object({
    printerId: Joi.string().max(100).optional(),
    printTemplate: Joi.object().optional()
}).min(1);

// ── Middleware ───────────────────────────────────────────────────────────────

// Middleware to ensure admin role
async function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== ROLES.ADMIN) {
        return res.error(req.t('ERRORS.ACCESS_DENIED_ADMIN'), 403);
    }
    next();
}

// ── Routes ───────────────────────────────────────────────────────────────────

router.get('/', verifyToken, requireAdmin, userController.getAll);
router.get('/restaurant/:slug', verifyToken, requireAdmin, userController.getByRestaurant);
router.patch('/me', verifyToken, validate(userProfileSchema), userController.updateProfile);
router.post('/', verifyToken, requireAdmin, validate(userAdminSchema), userController.createOrUpdate);
router.delete('/:id', verifyToken, requireAdmin, validate(mongoIdSchema, 'params'), userController.delete);
router.patch('/:id/print-settings', verifyToken, requireAdmin, validate(mongoIdSchema, 'params'), validate(printSettingsSchema), userController.updatePrintSettings);
router.post('/:id/copy-print-settings/:sourceUserId', verifyToken, requireAdmin, validate(mongoIdSchema.append({ sourceUserId: Joi.string().hex().length(24).required() }), 'params'), userController.copyPrintSettings);

export default router;
