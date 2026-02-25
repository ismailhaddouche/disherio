const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { generateToken, getCookieOptions, COOKIE_NAME } = require('../middleware/auth.middleware');

// POST /auth/login
router.post('/login',
    [
        body('username').trim().notEmpty().withMessage('Username is required'),
        body('password').notEmpty().withMessage('Password is required')
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
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const token = generateToken({ userId: user._id, role: user.role });

            // Set token as httpOnly cookie — inaccessible to JavaScript
            res.cookie(COOKIE_NAME, token, getCookieOptions());

            res.json({
                username: user.username,
                role: user.role
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// POST /auth/logout
router.post('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.json({ message: 'Logged out successfully' });
});

module.exports = router;
