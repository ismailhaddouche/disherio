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

// Middleware to ensure admin role
const requireAdmin = (req, res, next) => {
    console.log(`[DEBUG AUTH] User: ${req.user?.userId}, Role: ${req.user?.role}`);
    if (!req.user || req.user.role !== 'admin') {
        console.error(`[AUTH DENIED] User with role ${req.user?.role} tried to access admin route`);
        return res.status(403).json({ error: 'Acceso denegado: Se requiere rol de administrador' });
    }
    next();
};

// GET / - List all users (Full path: /api/users/)
router.get('/', verifyToken, requireAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /restaurant/:slug - Get users for a restaurant
router.get('/restaurant/:slug', verifyToken, requireAdmin, async (req, res) => {
    try {
        const users = await User.find({ restaurantSlug: req.params.slug }).select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /me - Update own profile
router.patch('/me',
    verifyToken,
    [
        body('username').optional().trim().notEmpty().withMessage('Username cannot be empty'),
        body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    ],
    validate,
    async (req, res) => {
        try {
            const user = await User.findById(req.user.userId);
            if (!user) return res.status(404).json({ error: 'User not found' });

            if (req.body.username) user.username = req.body.username;
            if (req.body.password) user.password = req.body.password;

            await user.save();
            
            const result = user.toObject();
            delete result.password;
            res.json(result);
        } catch (error) {
            if (error.code === 11000) {
                return res.status(400).json({ error: 'Username already in use' });
            }
            res.status(500).json({ error: error.message });
        }
    }
);

// POST / - Create or update user
router.post('/',
    verifyToken,
    requireAdmin,
    [
        body('username').trim().notEmpty().withMessage('Username is required'),
        body('role')
            .notEmpty().withMessage('Role is required')
            .isIn(['admin', 'kitchen', 'pos', 'customer', 'waiter']).withMessage('Invalid role'),
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

// DELETE /:id - Delete user
router.delete('/:id',
    verifyToken,
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

// PATCH /:id/print-settings - Update printer settings
router.patch('/:id/print-settings',
    verifyToken,
    requireAdmin,
    param('id').isMongoId().withMessage('Invalid user ID'),
    [
        body('printerId').optional().notEmpty().withMessage('printerId cannot be empty'),
        body('printTemplate').optional().isObject().withMessage('printTemplate must be an object')
    ],
    validate,
    async (req, res) => {
        try {
            const user = await User.findById(req.params.id);
            if (!user) return res.status(404).json({ error: 'User not found' });

            if (req.body.printerId) user.printerId = req.body.printerId;
            if (req.body.printTemplate) {
                user.printTemplate = { ...user.printTemplate.toObject(), ...req.body.printTemplate };
            }

            await user.save();
            res.json(user);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// POST /:id/copy-print-settings/:sourceUserId
router.post('/:id/copy-print-settings/:sourceUserId',
    verifyToken,
    requireAdmin,
    [
        param('id').isMongoId().withMessage('Invalid target user ID'),
        param('sourceUserId').isMongoId().withMessage('Invalid source user ID')
    ],
    validate,
    async (req, res) => {
        try {
            const sourceUser = await User.findById(req.params.sourceUserId);
            if (!sourceUser) return res.status(404).json({ error: 'Source user not found' });

            const targetUser = await User.findById(req.params.id);
            if (!targetUser) return res.status(404).json({ error: 'Target user not found' });

            targetUser.printerId = sourceUser.printerId;
            targetUser.printTemplate = sourceUser.printTemplate;

            await targetUser.save();
            res.json({ message: 'Print settings copied successfully', targetUser });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

module.exports = router;
