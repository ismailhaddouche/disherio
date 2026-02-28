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

// POST /orders/table/:tableNumber/add-items - Waiter adding items
router.post('/orders/table/:tableNumber/add-items',
    [
        param('tableNumber').trim().notEmpty().withMessage('Table number is required'),
        body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
        body('items.*.name').notEmpty().withMessage('Item name is required'),
        body('items.*.price').isFloat({ min: 0 }).withMessage('Item price must be non-negative'),
        body('items.*.quantity').isInt({ min: 1 }).withMessage('Item quantity must be at least 1'),
        body('guestId').optional().notEmpty(),
        body('guestName').optional().notEmpty()
    ],
    validate,
    verifyToken,
    async (req, res) => {
        try {
            const { tableNumber } = req.params;
            const { items, guestId, guestName } = req.body;

            let order = await Order.findOne({ tableNumber, status: 'active' });
            if (!order) {
                order = new Order({
                    tableNumber,
                    totemId: parseInt(tableNumber) || 0,
                    items: [],
                    totalAmount: 0
                });
            }

            let addedAmount = 0;
            const newItems = items.map(item => {
                addedAmount += item.price * item.quantity;
                return {
                    ...item,
                    status: 'pending',
                    orderedBy: {
                        // If waiter provides a guest, use it. Otherwise, it's an orphan.
                        id: guestId || 'orphan',
                        name: guestName || 'Huérfano'
                    }
                };
            });

            order.items.push(...newItems);
            order.totalAmount += addedAmount;
            await order.save();

            const io = req.app.get('io');
            if (io) io.emit('order-updated', order);

            res.status(200).json(order);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// PATCH /orders/:orderId/items/:itemId/associate - Cashier associating orphan item to a user
router.patch('/orders/:orderId/items/:itemId/associate',
    [
        param('orderId').isMongoId(),
        param('itemId').notEmpty(),
        body('userId').notEmpty().withMessage('userId is required'),
        body('userName').notEmpty().withMessage('userName is required')
    ],
    validate,
    verifyToken,
    async (req, res) => {
        try {
            const order = await Order.findById(req.params.orderId);
            if (!order) return res.status(404).json({ error: 'Order not found' });

            const item = order.items.id(req.params.itemId) || 
                         order.items.find(i => i.id === req.params.itemId || String(i._id) === req.params.itemId);
            
            if (!item) return res.status(404).json({ error: 'Item not found' });

            item.orderedBy = {
                id: req.body.userId,
                name: req.body.userName
            };

            await order.save();
            
            const io = req.app.get('io');
            if (io) io.emit('order-updated', order);

            res.json(order);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// POST /orders - Create or update a table order (Works for Totem Customers or Waiters)
router.post('/orders',
    verifyToken, // Identify who is ordering
    [
        body('totemId').optional().notEmpty().withMessage('totemId is required'),
        body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array')
    ],
    validate,
    async (req, res) => {
        try {
            const { tableNumber, totemId, items } = req.body;
            const tId = totemId || req.user.totemId;
            const tNumber = tableNumber || String(tId);

            if (!tId) return res.status(400).json({ error: 'Totem ID could not be determined' });

            let order = await Order.findOne({ 
                totemId: tId, 
                status: 'active' 
            });

            if (!order) {
                order = new Order({
                    tableNumber: tNumber,
                    totemId: tId,
                    items: [],
                    totalAmount: 0
                });
            }

            let addedAmount = 0;
            const taggedItems = items.map(item => {
                addedAmount += (item.price * item.quantity);
                return {
                    ...item,
                    status: 'pending',
                    orderedBy: {
                        id: req.user.userId,
                        name: req.user.username
                    }
                };
            });

            order.items.push(...taggedItems);
            order.totalAmount += addedAmount;
            await order.save();

            const io = req.app.get('io');
            if (io) io.emit('order-updated', order);

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
            .isIn(['pending', 'preparing', 'ready', 'served', 'cancelled']).withMessage('Status must be valid')
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

// POST /orders/:orderId/checkout - Process checkout (Full, Equal, By Item, or By User)
router.post('/orders/:orderId/checkout',
    [
        param('orderId').isMongoId().withMessage('Invalid order ID'),
        body('method')
            .notEmpty().withMessage('Payment method is required')
            .isIn(['cash', 'card']).withMessage('Method must be cash or card'),
        body('splitType')
            .optional()
            .isIn(['equal', 'single', 'by-item', 'by-user']).withMessage('splitType must be valid'),
        body('parts')
            .optional()
            .isInt({ min: 1, max: 20 }).withMessage('parts must be between 1 and 20'),
        body('itemIds')
            .optional()
            .isArray().withMessage('itemIds must be an array'),
        body('userId')
            .optional()
            .notEmpty().withMessage('userId is required for splitType: by-user')
    ],
    validate,
    verifyToken,
    async (req, res) => {
        try {
            const { splitType, parts, method, billingConfig, itemIds, userId } = req.body;
            const order = await Order.findById(req.params.orderId);
            if (!order) return res.status(404).json({ error: 'Order not found' });

            let finalAmount = 0;
            let itemsSummary = [];
            let totalPaidFlag = false;

            if (splitType === 'by-user' && userId) {
                // Check if there are ANY orphans in the order before allowing per-user payment
                const hasOrphans = order.items.some(item => item.orderedBy.id === 'orphan' && !item.isPaid);
                if (hasOrphans) {
                    return res.status(400).json({ 
                        error: 'Cannot process per-user payment while orphan items exist. Please associate all items first.',
                        code: 'ORPHANS_EXIST'
                    });
                }

                // BY USER: Pay everything ordered by a specific person
                const userItems = order.items.filter(item => 
                    item.orderedBy.id === userId && !item.isPaid
                );

                if (userItems.length === 0) {
                    return res.status(400).json({ error: 'No unpaid items found for this user' });
                }

                userItems.forEach(item => {
                    finalAmount += (item.price * item.quantity);
                    itemsSummary.push(`${item.quantity}x ${item.name}`);
                    item.isPaid = true;
                });

                const remaining = order.items.filter(i => !i.isPaid);
                if (remaining.length === 0) totalPaidFlag = true;

            } else if (splitType === 'by-item' && itemIds && itemIds.length > 0) {
                const itemsToPay = order.items.filter(item => 
                    itemIds.includes(item._id.toString()) && !item.isPaid
                );

                if (itemsToPay.length === 0) {
                    return res.status(400).json({ error: 'No unpaid items found for the provided IDs' });
                }

                itemsToPay.forEach(item => {
                    finalAmount += (item.price * item.quantity);
                    itemsSummary.push(`${item.quantity}x ${item.name}`);
                    item.isPaid = true;
                });

                const unpaidItems = order.items.filter(item => !item.isPaid);
                if (unpaidItems.length === 0) totalPaidFlag = true;

            } else {
                // FULL or EQUAL SPLIT
                let baseAmount = order.totalAmount || 0;
                
                if (billingConfig?.vatPercentage) baseAmount *= (1 + billingConfig.vatPercentage / 100);
                if (billingConfig?.tipEnabled && billingConfig?.tipPercentage) baseAmount *= (1 + billingConfig.tipPercentage / 100);

                const numParts = (splitType === 'equal' && parts > 1) ? parts : 1;
                finalAmount = Math.round((baseAmount / numParts) * 100) / 100;
                itemsSummary = order.items.map(item => `${item.quantity}x ${item.name}`);
                
                if (splitType !== 'equal' || (splitType === 'equal' && numParts === 1)) {
                    totalPaidFlag = true;
                    order.items.forEach(i => i.isPaid = true);
                }
            }

            // Create the ticket(s)
            const ticketCount = (splitType === 'equal' && parts > 1) ? parts : 1;
            const generatedTickets = [];

            for (let i = 0; i < ticketCount; i++) {
                const ticket = new Ticket({
                    orderId: order._id,
                    customId: `${order._id.toString().slice(-6).toUpperCase()}/${i + 1}-${ticketCount}`,
                    method: method || 'cash',
                    amount: finalAmount,
                    itemsSummary
                });
                await ticket.save();
                generatedTickets.push(ticket);
            }

            if (totalPaidFlag) {
                order.paymentStatus = 'paid';
                order.status = 'completed';
            } else if (splitType === 'by-item' || splitType === 'by-user') {
                order.paymentStatus = 'split';
            }

            await order.save();

            const io = req.app.get('io');
            if (io) io.emit('order-updated', order);

            res.json({ tickets: generatedTickets, orderStatus: order.status });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

module.exports = router;
