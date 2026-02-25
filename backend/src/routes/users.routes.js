const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth.middleware');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }
    next();
};

// Secure all user management routes
router.use(verifyToken);

// Middleware to ensure admin role
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin role required' });
    }
    next();
};

// GET /users - Get all users
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /users - Create or update user
router.post('/users',
    requireAdmin,
    [
        body('username').trim().notEmpty().withMessage('Username is required'),
        body('role')
            .notEmpty().withMessage('Role is required')
            .isIn(['admin', 'kitchen', 'pos']).withMessage('Role must be admin, kitchen, or pos'),
        body('password')
            .if(body('_id').not().exists())
            .notEmpty().withMessage('Password is required for new users')
            .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    ],
    validate,
    async (req, res) => {
        try {
            const { _id, ...data } = req.body;

            let user;
            if (_id) {
                user = await User.findById(_id);
                if (!user) return res.status(404).json({ error: 'User not found' });
                Object.assign(user, data);
                await user.save();
            } else {
                user = new User(data);
                await user.save();
            }
            const result = user.toObject();
            delete result.password;
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// DELETE /users/:id - Delete user
router.delete('/users/:id',
    requireAdmin,
    param('id').isMongoId().withMessage('Invalid user ID'),
    validate,
    async (req, res) => {
        try {
            await User.findByIdAndDelete(req.params.id);
            res.json({ message: 'User deleted' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

module.exports = router;
