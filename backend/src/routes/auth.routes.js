const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { generateToken, getCookieOptions, COOKIE_NAME } = require('../middleware/auth.middleware');

// POST /auth/login
router.post('/login',
    [
        body('username').trim().notEmpty().withMessage((value, { req }) => req.t('AUTH.REQ_USERNAME')),
        body('password').notEmpty().withMessage((value, { req }) => req.t('AUTH.REQ_PASSWORD'))
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        try {
            const { username, password } = req.body;
            const user = await User.findOne({ username, active: true });

            if (!user || !(await user.comparePassword(password))) {
                return res.status(401).json({ error: req.t('ERRORS.INVALID_CREDENTIALS') });
            }

            const token = generateToken({ userId: user._id, role: user.role });

            // Set token as httpOnly cookie — inaccessible to JavaScript
            res.cookie(COOKIE_NAME, token, getCookieOptions());

            res.json({
                username: user.username,
                role: user.role,
                printerId: user.printerId,
                printTemplate: user.printTemplate
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// POST /auth/customer-session - Guest joining a table via Totem
router.post('/customer-session',
    [
        body('restaurantSlug').notEmpty().withMessage((value, { req }) => req.t('AUTH.REQ_SLUG')),
        body('totemId').notEmpty().withMessage((value, { req }) => req.t('AUTH.REQ_TOTEM')),
        body('name').trim().notEmpty().withMessage((value, { req }) => req.t('AUTH.REQ_GUEST'))
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

        try {
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
            res.json({ username: name, role: 'customer', restaurantSlug, totemId });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// POST /auth/logout
router.post('/logout', (req, res) => {
    const { getCookieOptions, COOKIE_NAME } = require('../middleware/auth.middleware');
    const options = { ...getCookieOptions() };
    delete options.maxAge; // Remove maxAge for clearing
    res.clearCookie(COOKIE_NAME, { path: options.path || '/' });
    res.json({ message: req.t('ERRORS.LOGGED_OUT') });
});

module.exports = router;
