import express from 'express';
const router = express.Router();
import Joi from 'joi';
import User from '../models/User.js';
import AuditService from '../services/audit.service.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { validate, mongoIdSchema } from '../middleware/validation.middleware.js';
import { ROLES } from '../constants.js';

// ── Joi Schemas ──────────────────────────────────────────────────────────────

const userProfileSchema = Joi.object({
    username: Joi.string().min(3).max(50).trim().optional(),
    password: Joi.string().min(8).max(100).optional()
}).min(1);

const userAdminSchema = Joi.object({
    _id: Joi.string().hex().length(24).optional(),
    username: Joi.string().required().min(3).max(50).trim(),
    role: Joi.string().valid('admin', 'kitchen', 'pos', 'customer', 'waiter').required(),
    password: Joi.string().min(8).max(100).optional(),
    restaurantSlug: Joi.string().max(100).optional(),
    printerId: Joi.string().max(100).optional(),
    printTemplate: Joi.object().optional()
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

// GET / - List all users
router.get('/', verifyToken, requireAdmin, async function(req, res) {
    const users = await User.find().select('-password');
    res.success(users);
});

// GET /restaurant/:slug - Get users for a restaurant
router.get('/restaurant/:slug', verifyToken, requireAdmin, async function(req, res) {
    const users = await User.find({ restaurantSlug: req.params.slug }).select('-password');
    res.success(users);
});

// PATCH /me - Update own profile
router.patch('/me',
    verifyToken,
    validate(userProfileSchema),
    async function(req, res) {
        const user = await User.findById(req.user.userId);
        if (!user) return res.error(req.t('ERRORS.USER_NOT_FOUND'), 404);

        if (req.body.username) user.username = req.body.username;
        if (req.body.password) user.password = req.body.password;

        try {
            const oldState = user.toObject();
            await user.save();
            
            await AuditService.logChange(req, 'USER_PROFILE_UPDATED', oldState, user.toObject(), {
                fields: Object.keys(req.body)
            });
        } catch (error) {
            if (error.code === 11000) return res.error(req.t('ERRORS.USERNAME_IN_USE'), 400);
            throw error;
        }

        const result = user.toObject();
        delete result.password;
        res.success(result);
    }
);

// POST / - Create or update user
router.post('/',
    verifyToken,
    requireAdmin,
    validate(userAdminSchema),
    async function(req, res) {
        const { _id, ...data } = req.body;

        let user;
        if (_id) {
            user = await User.findById(_id);
            if (!user) return res.error(req.t('ERRORS.USER_NOT_FOUND'), 404);
            
            const oldUser = user.toObject(); // Capture old state for audit
            Object.assign(user, data);
            await user.save();
            
            await AuditService.logChange(req, 'USER_UPDATED', oldUser, user.toObject(), {
                targetUserId: user._id,
                targetUsername: user.username
            });
        } else {
            user = new User(data);
            await user.save();
            await AuditService.log(req, 'USER_CREATED', {
                targetUserId: user._id,
                targetUsername: user.username,
                role: user.role
            });
        }
        const result = user.toObject();
        delete result.password;
        res.success(result);
    }
);

// DELETE /:id - Delete user
router.delete('/:id',
    verifyToken,
    requireAdmin,
    validate(mongoIdSchema, 'params'),
    async function(req, res) {
        const user = await User.findById(req.params.id); // Fetch user before deletion for audit log
        if (!user) return res.error(req.t('ERRORS.USER_NOT_FOUND'), 404);

        await AuditService.log(req, 'USER_DELETED', {
            targetUserId: user._id,
            targetUsername: user.username
        });

        await User.findByIdAndDelete(req.params.id);
        res.success({ message: 'User deleted' });
    }
);

// PATCH /:id/print-settings - Update printer settings
router.patch('/:id/print-settings',
    verifyToken,
    requireAdmin,
    validate(mongoIdSchema, 'params'),
    validate(printSettingsSchema),
    async function(req, res) {
        const user = await User.findById(req.params.id);
        if (!user) return res.error(req.t('ERRORS.USER_NOT_FOUND'), 404);

        const oldState = user.toObject();
        if (req.body.printerId) user.printerId = req.body.printerId;
        if (req.body.printTemplate) {
            user.printTemplate = { ...user.printTemplate.toObject(), ...req.body.printTemplate };
        }

        await user.save();
        
        await AuditService.logChange(req, 'USER_PRINT_SETTINGS_UPDATED', oldState, user.toObject(), {
            targetUserId: user._id,
            targetUsername: user.username
        });

        res.success(user);
    }
);

// POST /:id/copy-print-settings/:sourceUserId
router.post('/:id/copy-print-settings/:sourceUserId',
    verifyToken,
    requireAdmin,
    validate(mongoIdSchema.append({ sourceUserId: Joi.string().hex().length(24).required() }), 'params'),
    async function(req, res) {
        const sourceUser = await User.findById(req.params.sourceUserId);
        if (!sourceUser) return res.error(req.t('ERRORS.SOURCE_USER_NOT_FOUND'), 404);

        const targetUser = await User.findById(req.params.id);
        if (!targetUser) return res.error(req.t('ERRORS.TARGET_USER_NOT_FOUND'), 404);

        targetUser.printerId = sourceUser.printerId;
        targetUser.printTemplate = sourceUser.printTemplate;

        await targetUser.save();
        res.success({ message: 'Print settings copied successfully', targetUser });
    }
);

export default router;
