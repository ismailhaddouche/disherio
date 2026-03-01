const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const { verifyToken } = require('../middleware/auth.middleware');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }
    next();
};

// GET / - List active orders (Full: /api/orders/)
router.get('/', verifyToken, async (req, res) => {
    try {
        const orders = await Order.find({ status: 'active' }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /table/:tableNumber - Get order for table
router.get('/table/:tableNumber',
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

// POST /table/:tableNumber/add-items - Waiter adding items
router.post('/table/:tableNumber/add-items',
    [
        param('tableNumber').trim().notEmpty().withMessage('Table number is required'),
        body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
        body('items.*.name').notEmpty().withMessage('Item name is required'),
        body('items.*.price').isFloat({ min: 0 }).withMessage('Item price must be non-negative'),
        body('items.*.quantity').isInt({ min: 1 }).withMessage('Item quantity must be at least 1')
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

// PATCH /:orderId/items/:itemId/associate
router.patch('/:orderId/items/:itemId/associate',
    [
        param('orderId').isMongoId(),
        param('itemId').notEmpty(),
        body('userId').notEmpty(),
        body('userName').notEmpty()
    ],
    validate,
    verifyToken,
    async (req, res) => {
        try {
            const order = await Order.findById(req.params.orderId);
            if (!order) return res.status(404).json({ error: 'Order not found' });
            const item = order.items.find(i => String(i._id) === req.params.itemId);
            if (!item) return res.status(404).json({ error: 'Item not found' });
            item.orderedBy = { id: req.body.userId, name: req.body.userName };
            await order.save();
            const io = req.app.get('io');
            if (io) io.emit('order-updated', order);
            res.json(order);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// POST / - Create or update a table order
router.post('/',
    verifyToken,
    [
        body('totemId').optional().notEmpty(),
        body('items').isArray({ min: 1 })
    ],
    validate,
    async (req, res) => {
        try {
            const { tableNumber, totemId, items } = req.body;
            const tId = totemId || req.user.totemId;
            const tNumber = tableNumber || String(tId);
            if (!tId) return res.status(400).json({ error: 'Totem ID required' });

            let order = await Order.findOne({ totemId: tId, status: 'active' });
            if (!order) {
                order = new Order({ tableNumber: tNumber, totemId: tId, items: [], totalAmount: 0 });
            }

            let addedAmount = 0;
            const taggedItems = items.map(item => {
                addedAmount += (item.price * item.quantity);
                return {
                    ...item,
                    status: 'pending',
                    orderedBy: { id: req.user.userId, name: req.user.username }
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

// PATCH /:orderId - Update order
router.patch('/:orderId',
    param('orderId').isMongoId(),
    validate,
    verifyToken,
    async (req, res) => {
        try {
            const order = await Order.findByIdAndUpdate(req.params.orderId, { $set: req.body }, { new: true });
            if (!order) return res.status(404).json({ error: 'Order not found' });
            const io = req.app.get('io');
            if (io) io.emit('order-updated', order);
            res.json(order);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// PATCH /:orderId/items/:itemId - Status update
router.patch('/:orderId/items/:itemId',
    [
        param('orderId').isMongoId(),
        body('status').notEmpty().isIn(['pending', 'preparing', 'ready', 'served', 'cancelled'])
    ],
    validate,
    verifyToken,
    async (req, res) => {
        try {
            const order = await Order.findById(req.params.orderId);
            if (!order) return res.status(404).json({ error: 'Order not found' });
            const item = order.items.find(i => String(i._id) === req.params.itemId);
            if (!item) return res.status(404).json({ error: 'Item not found' });
            item.status = req.body.status;
            await order.save();
            const io = req.app.get('io');
            if (io) io.emit('order-updated', order);
            res.json(order);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// POST /:orderId/checkout - Process payment
router.post('/:orderId/checkout',
    [
        param('orderId').isMongoId(),
        body('method').notEmpty().isIn(['cash', 'card']),
        body('splitType').optional().isIn(['equal', 'single', 'by-item', 'by-user'])
    ],
    validate,
    verifyToken,
    async (req, res) => {
        try {
            const { splitType, parts, method, billingConfig, itemIds, userId } = req.body;
            const order = await Order.findById(req.params.orderId);
            if (!order) return res.status(404).json({ error: 'Order not found' });

            let itemsTotal = 0;
            let itemsSummary = [];
            let totalPaidFlag = false;

            if (splitType === 'by-user' && userId) {
                const hasOrphans = order.items.some(item => item.orderedBy.id === 'orphan' && !item.isPaid);
                if (hasOrphans) return res.status(400).json({ error: 'Existen platos huérfanos', code: 'ORPHANS_EXIST' });
                const userItems = order.items.filter(item => item.orderedBy.id === userId && !item.isPaid);
                if (userItems.length === 0) return res.status(400).json({ error: 'No unpaid items' });
                userItems.forEach(item => {
                    itemsTotal += (item.price * item.quantity);
                    itemsSummary.push(`${item.quantity}x ${item.name}`);
                    item.isPaid = true;
                });
                if (order.items.every(i => i.isPaid)) totalPaidFlag = true;
            } else if (splitType === 'by-item' && itemIds?.length > 0) {
                const itemsToPay = order.items.filter(item => itemIds.includes(item._id.toString()) && !item.isPaid);
                itemsToPay.forEach(item => {
                    itemsTotal += (item.price * item.quantity);
                    itemsSummary.push(`${item.quantity}x ${item.name}`);
                    item.isPaid = true;
                });
                if (order.items.every(i => i.isPaid)) totalPaidFlag = true;
            } else {
                const numParts = (splitType === 'equal' && parts > 1) ? parts : 1;
                itemsTotal = (order.totalAmount || 0) / numParts;
                itemsSummary = order.items.map(item => `${item.quantity}x ${item.name}`);
                if (splitType !== 'equal' || numParts === 1) {
                    totalPaidFlag = true;
                    order.items.forEach(i => i.isPaid = true);
                }
            }

            let finalTicketAmount = itemsTotal;
            if (billingConfig?.tipEnabled && billingConfig?.tipPercentage) {
                finalTicketAmount += (itemsTotal * (billingConfig.tipPercentage / 100));
            }
            finalTicketAmount = Math.round(finalTicketAmount * 100) / 100;

            const ticketCount = (splitType === 'equal' && parts > 1) ? parts : 1;
            const generatedTickets = [];
            for (let i = 0; i < ticketCount; i++) {
                const ticket = new Ticket({
                    orderId: order._id,
                    customId: `${order._id.toString().slice(-6).toUpperCase()}/${i + 1}-${ticketCount}`,
                    method: method || 'cash',
                    amount: finalTicketAmount,
                    itemsSummary
                });
                await ticket.save();
                generatedTickets.push(ticket);
            }

            order.paymentStatus = totalPaidFlag ? 'paid' : 'split';
            if (totalPaidFlag) order.status = 'completed';
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
