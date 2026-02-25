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

// GET /menu - List all menu items
router.get('/menu', async (req, res) => {
    try {
        const items = await MenuItem.find().sort({ category: 1, order: 1, name: 1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /menu - Create or update a menu item
router.post('/menu',
    [
        body('name').trim().notEmpty().withMessage('Item name is required'),
        body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),
        body('category').trim().notEmpty().withMessage('Category is required')
    ],
    validate,
    verifyToken,
    async (req, res) => {
        try {
            const { _id, ...data } = req.body;

            let item;
            if (_id) {
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

// DELETE /menu/:id - Delete a menu item
router.delete('/menu/:id',
    param('id').isMongoId().withMessage('Invalid menu item ID'),
    validate,
    verifyToken,
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

// POST /menu/:productId/toggle - Toggle item availability
router.post('/menu/:productId/toggle',
    param('productId').isMongoId().withMessage('Invalid menu item ID'),
    validate,
    verifyToken,
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
