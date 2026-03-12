import express from 'express';
const router = express.Router();
import Joi from 'joi';
import User from '../models/User.js';
import { generateToken, getCookieOptions, COOKIE_NAME } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';

// ── Joi Schemas ──────────────────────────────────────────────────────────────

const loginSchema = Joi.object({
    username: Joi.string().required().max(50).trim(),
    password: Joi.string().required().max(100)
});

const customerSessionSchema = Joi.object({
    restaurantSlug: Joi.string().required().max(100),
    totemId: Joi.number().integer().required(),
    name: Joi.string().required().min(1).max(50).trim()
});

// ── Routes ───────────────────────────────────────────────────────────────────

// POST /auth/login
router.post('/login',
    validate(loginSchema),
    async function(req, res) {
        const { username, password } = req.body;
        const user = await User.findOne({ username, active: true });

        if (!user || !(await user.comparePassword(password))) {
            return res.error(req.t('ERRORS.INVALID_CREDENTIALS'), 401);
        }

        const token = generateToken({ userId: user._id, username: user.username, role: user.role });

        // Set token as httpOnly cookie — inaccessible to JavaScript
        res.cookie(COOKIE_NAME, token, getCookieOptions());

        res.success({
            username: user.username,
            role: user.role,
            printerId: user.printerId,
            printTemplate: user.printTemplate
        });
    }
);

// POST /auth/customer-session - Guest joining a table via Totem
router.post('/customer-session',
    validate(customerSessionSchema),
    async function(req, res) {
        const { restaurantSlug, totemId, name } = req.body;

        // Create a temporary JWT for the customer
        const token = generateToken({
            userId: `guest-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            username: name,
            role: 'customer',
            restaurantSlug,
            totemId
        });

        res.cookie(COOKIE_NAME, token, getCookieOptions());
        res.success({ username: name, role: 'customer', restaurantSlug, totemId });
    }
);

// POST /auth/logout
router.post('/logout', function(req, res) {
    const options = { ...getCookieOptions() };
    delete options.maxAge; // Remove maxAge for clearing
    res.clearCookie(COOKIE_NAME, { path: options.path || '/' });
    res.success({ message: req.t('ERRORS.LOGGED_OUT') });
});

export default router;
