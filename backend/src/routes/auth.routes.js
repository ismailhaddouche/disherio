import express from 'express';
const router = express.Router();
import Joi from 'joi';
import { validate } from '../middleware/validation.middleware.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import authController from '../controllers/auth.controller.js';

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

router.post('/login', validate(loginSchema), authController.login);
router.get('/me', verifyToken, authController.me);
router.post('/customer-session', validate(customerSessionSchema), authController.customerSession);
router.post('/logout', authController.logout);

export default router;
