const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const MenuItem = require('../models/MenuItem');
const { verifyToken } = require('../middleware/auth.middleware');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }
    next();
};

// Middleware to restrict certain actions to admin OR kitchen (for specific categories)
const authorizeKitchenAction = async (req, res, next) => {
    if (req.user.role === 'admin') return next();
    
    if (req.user.role === 'kitchen') {
        const category = req.body.category || (req.params.id ? (await MenuItem.findById(req.params.id))?.category : null);
        if (category === 'Fuera de Carta') {
            return next();
        }
        return res.status(403).json({ error: 'La cocina solo puede gestionar platos "Fuera de Carta"' });
    }
    
    res.status(403).json({ error: 'Acceso denegado' });
};

// GET / - List all menu items (Full path: /api/menu/)
router.get('/', async (req, res) => {
    try {
        const items = await MenuItem.find().sort({ category: 1, order: 1, name: 1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST / - Create or update a menu item
router.post('/',
    verifyToken,
    authorizeKitchenAction,
    [
        body('name').trim().notEmpty().withMessage('Item name is required'),
        body('basePrice').isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),
        body('category').trim().notEmpty().withMessage('Category is required')
    ],
    validate,
    async (req, res) => {
        try {
            const { _id, ...data } = req.body;

            let item;
            if (_id) {
                if (req.user.role === 'kitchen' && data.category !== 'Fuera de Carta') {
                    return res.status(403).json({ error: 'La cocina no puede mover platos fuera de "Fuera de Carta"' });
                }

                item = await MenuItem.findByIdAndUpdate(_id, data, { new: true });
                if (!item) {
                    return res.status(404).json({ error: 'Menu item not found' });
                }
            } else {
                item = new MenuItem(data);
                await item.save();
            }

            const io = req.app.get('io');
            if (io) {
                io.emit('menu-update', item);
            }

            res.json(item);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// DELETE /:id - Delete a menu item
router.delete('/:id',
    verifyToken,
    authorizeKitchenAction,
    param('id').isMongoId().withMessage('Invalid menu item ID'),
    validate,
    async (req, res) => {
        try {
            const item = await MenuItem.findByIdAndDelete(req.params.id);
            if (!item) {
                return res.status(404).json({ error: 'Menu item not found' });
            }

            const io = req.app.get('io');
            if (io) {
                io.emit('menu-update', { deleted: item._id });
            }

            res.json({ message: 'Menu item deleted' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// POST /:productId/toggle - Toggle item availability
router.post('/:productId/toggle',
    verifyToken,
    async (req, res, next) => {
        if (['admin', 'kitchen'].includes(req.user.role)) return next();
        res.status(403).json({ error: 'Solo administración o cocina pueden cambiar la disponibilidad' });
    },
    param('productId').isMongoId().withMessage('Invalid menu item ID'),
    validate,
    async (req, res) => {
        try {
            const item = await MenuItem.findById(req.params.productId);
            if (!item) {
                return res.status(404).json({ error: 'Menu item not found' });
            }

            item.available = !item.available;
            await item.save();

            const io = req.app.get('io');
            if (io) {
                io.emit('menu-update', item);
            }

            res.json(item);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

module.exports = router;
