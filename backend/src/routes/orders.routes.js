const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const { verifyToken } = require('../middleware/auth.middleware');

// Reusable validation error handler
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }
    next();
};

// GET /orders - List active orders
router.get('/orders', verifyToken, async (req, res) => {
    try {
        const orders = await Order.find({ status: 'active' }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /orders/table/:tableNumber - Get active order for a specific table
router.get('/orders/table/:tableNumber',
    param('tableNumber').trim().notEmpty().withMessage('Table number is required'),
    validate,
    async (req, res) => {
        try {
            const order = await Order.findOne({
                tableNumber: req.params.tableNumber,
                status: 'active'
            });
            res.json(order);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// POST /orders/table/:tableNumber/add-items - Waiter adding items to an existing order
router.post('/orders/table/:tableNumber/add-items',
    [
        param('tableNumber').trim().notEmpty().withMessage('Table number is required'),
        body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
        body('items.*.name').notEmpty().withMessage('Item name is required'),
        body('items.*.price').isFloat({ min: 0 }).withMessage('Item price must be non-negative'),
        body('items.*.quantity').isInt({ min: 1 }).withMessage('Item quantity must be at least 1')
    ],
    validate,
    verifyToken, // Ensure only logged-in staff can use this
    async (req, res) => {
        try {
            const { tableNumber } = req.params;
            const { items } = req.body;

            let order = await Order.findOne({ tableNumber, status: 'active' });

            if (!order) {
                // If no active order, create a new one automatically (first round)
                order = new Order({
                    tableNumber,
                    totemId: parseInt(tableNumber) || 0, // Fallback to tableNumber as totemId
                    items: [],
                    totalAmount: 0
                });
            }

            // Append new items and update total
            let addedAmount = 0;
            const newItems = items.map(item => {
                addedAmount += item.price * item.quantity;
                return {
                    ...item,
                    status: 'pending',
                    orderedBy: {
                        id: req.user.userId,
                        name: req.user.username
                    }
                };
            });

            order.items.push(...newItems);
            order.totalAmount += addedAmount;
            await order.save();

            const io = req.app.get('io');
            if (io) {
                io.emit('order-updated', order);
            }

            res.status(200).json(order);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// POST /orders - Create a new order
router.post('/orders',
    [
        body('totemId').notEmpty().withMessage('totemId is required'),
        body('items').isArray().withMessage('items must be an array'),
        body('totalAmount').isFloat({ min: 0 }).withMessage('totalAmount must be a non-negative number')
    ],
    validate,
    async (req, res) => {
        try {
            const { tableNumber, totemId, items, totalAmount } = req.body;
            const order = new Order({
                tableNumber: tableNumber || String(totemId),
                totemId,
                items: items || [],
                totalAmount: totalAmount || 0
            });
            await order.save();

            const io = req.app.get('io');
            if (io) {
                io.emit('order-update', order);
            }

            res.status(201).json(order);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// PATCH /orders/:orderId - Update order
router.patch('/orders/:orderId',
    param('orderId').isMongoId().withMessage('Invalid order ID'),
    validate,
    verifyToken,
    async (req, res) => {
        try {
            const order = await Order.findByIdAndUpdate(
                req.params.orderId,
                { $set: req.body },
                { new: true }
            );
            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }

            const io = req.app.get('io');
            if (io) {
                io.emit('order-updated', order);
            }

            res.json(order);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// PATCH /orders/:orderId/items/:itemId - Update a single item's status
router.patch('/orders/:orderId/items/:itemId',
    [
        param('orderId').isMongoId().withMessage('Invalid order ID'),
        body('status')
            .notEmpty().withMessage('Status is required')
            .isIn(['pending', 'preparing', 'ready']).withMessage('Status must be pending, preparing, or ready')
    ],
    validate,
    verifyToken,
    async (req, res) => {
        try {
            const { status } = req.body;
            const order = await Order.findById(req.params.orderId);
            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }

            const item = order.items.find(
                i => i.id === req.params.itemId || String(i._id) === req.params.itemId
            );
            if (!item) {
                return res.status(404).json({ error: 'Item not found' });
            }

            item.status = status;
            await order.save();

            const io = req.app.get('io');
            if (io) {
                io.emit('order-updated', order);
            }

            res.json(order);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// POST /orders/:orderId/complete - Mark order as completed
router.post('/orders/:orderId/complete',
    param('orderId').isMongoId().withMessage('Invalid order ID'),
    validate,
    verifyToken,
    async (req, res) => {
        try {
            const order = await Order.findByIdAndUpdate(
                req.params.orderId,
                { status: 'completed', paymentStatus: 'paid' },
                { new: true }
            );
            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }

            const io = req.app.get('io');
            if (io) {
                io.emit('order-updated', order);
            }

            res.json(order);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// POST /orders/:orderId/checkout - Process checkout with payment splitting
router.post('/orders/:orderId/checkout',
    [
        param('orderId').isMongoId().withMessage('Invalid order ID'),
        body('method')
            .notEmpty().withMessage('Payment method is required')
            .isIn(['cash', 'card']).withMessage('Method must be cash or card'),
        body('splitType')
            .optional()
            .isIn(['equal', 'single']).withMessage('splitType must be equal or single'),
        body('parts')
            .optional()
            .isInt({ min: 1, max: 20 }).withMessage('parts must be between 1 and 20')
    ],
    validate,
    verifyToken,
    async (req, res) => {
        try {
            const { splitType, parts, method, billingConfig } = req.body;
            const order = await Order.findById(req.params.orderId);
            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }

            let baseAmount = order.totalAmount || 0;

            if (billingConfig && billingConfig.vatPercentage) {
                baseAmount = baseAmount * (1 + billingConfig.vatPercentage / 100);
            }

            if (billingConfig && billingConfig.tipEnabled && billingConfig.tipPercentage) {
                baseAmount = baseAmount * (1 + billingConfig.tipPercentage / 100);
            }

            const tickets = [];
            const numParts = (splitType === 'equal' && parts > 1) ? parts : 1;
            const amountPerPart = Math.round((baseAmount / numParts) * 100) / 100;

            for (let i = 0; i < numParts; i++) {
                const ticket = new Ticket({
                    orderId: order._id,
                    customId: `${order._id.toString().slice(-6).toUpperCase()}/${i + 1}-${numParts}`,
                    method: method || 'cash',
                    amount: amountPerPart,
                    itemsSummary: order.items.map(item => `${item.quantity}x ${item.name}`)
                });
                await ticket.save();
                tickets.push(ticket);
            }

            order.paymentStatus = 'paid';
            order.status = 'completed';
            await order.save();

            const io = req.app.get('io');
            if (io) {
                io.emit('order-updated', order);
            }

            res.json({ tickets });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

module.exports = router;
