import express from 'express';
const router = express.Router();
import Joi from 'joi';
import Order from '../models/Order.js';
import Ticket from '../models/Ticket.js';
import Restaurant from '../models/Restaurant.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { validate, orderPlacementSchema } from '../middleware/validation.middleware.js';

// ── Joi Schemas ──────────────────────────────────────────────────────────────

const addItemsSchema = Joi.object({
    items: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        price: Joi.number().min(0).required(),
        quantity: Joi.number().integer().min(1).required(),
        image: Joi.string().allow('').optional()
    }).unknown(true)).min(1).required(),
    guestId: Joi.string().allow(''),
    guestName: Joi.string().allow('')
}).unknown(true);

const associateSchema = Joi.object({
    userId: Joi.string().required(),
    userName: Joi.string().required()
});

const orderUpdateSchema = Joi.object({
    status: Joi.string().valid('active', 'completed', 'cancelled'),
    paymentStatus: Joi.string().valid('unpaid', 'paid', 'split', 'processing'),
    items: Joi.array(),
    totalAmount: Joi.number()
}).min(1);

const itemStatusSchema = Joi.object({
    status: Joi.string().valid('pending', 'preparing', 'ready', 'served', 'cancelled').required()
});

const checkoutSchema = Joi.object({
    method: Joi.string().valid('cash', 'card').required(),
    splitType: Joi.string().valid('equal', 'single', 'by-item', 'by-user'),
    parts: Joi.number().integer().min(1),
    userId: Joi.string().allow(''),
    itemIds: Joi.array().items(Joi.string()),
    billingConfig: Joi.object().unknown(true)
}).unknown(true);

// ── Routes ───────────────────────────────────────────────────────────────────

// GET / - List active orders (Restricted to staff)
router.get('/', verifyToken, async (req, res) => {
    const orders = await Order.find({ status: 'active' }).sort({ createdAt: -1 });
    res.success(orders);
});

// GET /table/:tableNumber - Get order for table (Public for Totem)
router.get('/table/:tableNumber', async (req, res) => {
    const order = await Order.findOne({
        tableNumber: req.params.tableNumber,
        status: 'active'
    });
    res.success(order || null);
});

// GET /session/:sessionId - Get order by session code (Public)
router.get('/session/:sessionId', async (req, res) => {
    const order = await Order.findOne({
        sessionId: req.params.sessionId,
        status: 'active'
    });
    res.success(order || null);
});

// POST /table/:tableNumber/add-items - Waiter adding items (Restricted)
router.post('/table/:tableNumber/add-items',
    verifyToken,
    validate(addItemsSchema),
    async (req, res) => {
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
                    id: guestId || 'staff',
                    name: guestName || req.user.username || 'Personal'
                }
            };
        });

        order.items.push(...newItems);
        order.totalAmount += addedAmount;
        await order.save();

        const io = req.app.get('io');
        if (io) io.emit('order-updated', order);

        res.success(order);
    }
);

// PATCH /:orderId/items/:itemId/associate - Restricted to staff
router.patch('/:orderId/items/:itemId/associate',
    verifyToken,
    validate(associateSchema),
    async (req, res) => {
        const order = await Order.findById(req.params.orderId);
        if (!order) return res.error(req.t('ERRORS.ORDER_NOT_FOUND'), 404);

        const item = order.items.id(req.params.itemId) || order.items.find(i => String(i._id) === req.params.itemId);
        if (!item) return res.error(req.t('ERRORS.ITEM_NOT_FOUND'), 404);

        item.orderedBy = { id: req.body.userId, name: req.body.userName };
        await order.save();

        const io = req.app.get('io');
        if (io) io.emit('order-updated', order);

        res.success(order);
    }
);

// POST / - Create or update a table order (Public for Totem Customers)
router.post('/',
    validate(orderPlacementSchema),
    async (req, res) => {
        const { tableNumber, totemId, sessionId, items } = req.body;
        const tId = totemId;
        const tNumber = tableNumber || String(tId);

        let order = await Order.findOne({ sessionId: sessionId, status: 'active' });
        if (!order) {
            order = new Order({ tableNumber: tNumber, totemId: tId, sessionId: sessionId, items: [], totalAmount: 0 });
        }

        let addedAmount = 0;
        const taggedItems = items.map(item => {
            addedAmount += (item.price * item.quantity);
            return {
                ...item,
                status: 'pending',
                orderedBy: {
                    id: req.user?.userId || 'guest',
                    name: req.user?.username || 'Invitado'
                }
            };
        });

        order.items.push(...taggedItems);
        order.totalAmount += addedAmount;
        await order.save();

        const io = req.app.get('io');
        if (io) io.emit('order-updated', order);

        res.success(order, 201);
    }
);

// PATCH /:orderId - Update order (Restricted)
router.patch('/:orderId',
    verifyToken,
    validate(orderUpdateSchema),
    async (req, res) => {
        const ALLOWED = ['status', 'paymentStatus', 'items', 'totalAmount'];
        const updateData = {};
        for (const field of ALLOWED) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }

        const order = await Order.findByIdAndUpdate(req.params.orderId, { $set: updateData }, { new: true });
        if (!order) return res.error(req.t('ERRORS.ORDER_NOT_FOUND'), 404);

        const io = req.app.get('io');
        if (io) io.emit('order-updated', order);

        res.success(order);
    }
);

// PATCH /:orderId/items/bulk-status - Bulk status update (Restricted)
router.patch('/:orderId/items/bulk-status',
    verifyToken,
    validate(itemStatusSchema),
    async (req, res) => {
        const order = await Order.findById(req.params.orderId);
        if (!order) return res.error(req.t('ERRORS.ORDER_NOT_FOUND'), 404);

        order.items.forEach(item => {
            if (item.status !== 'served' && item.status !== 'cancelled') {
                item.status = req.body.status;
            }
        });
        await order.save();

        const io = req.app.get('io');
        if (io) io.emit('order-updated', order);

        res.success(order);
    }
);

// PATCH /:orderId/items/:itemId - Status update (Restricted)
router.patch('/:orderId/items/:itemId',
    verifyToken,
    validate(itemStatusSchema),
    async (req, res) => {
        const order = await Order.findById(req.params.orderId);
        if (!order) return res.error(req.t('ERRORS.ORDER_NOT_FOUND'), 404);

        const item = order.items.id(req.params.itemId) || order.items.find(i => String(i._id) === req.params.itemId);
        if (!item) return res.error(req.t('ERRORS.ITEM_NOT_FOUND'), 404);

        item.status = req.body.status;
        await order.save();

        const io = req.app.get('io');
        if (io) io.emit('order-updated', order);

        res.success(order);
    }
);

// POST /:orderId/checkout - Process payment (Restricted)
router.post('/:orderId/checkout',
    verifyToken,
    validate(checkoutSchema),
    async (req, res) => {
        const { splitType, parts, method, billingConfig, itemIds, userId } = req.body;
        const order = await Order.findById(req.params.orderId);
        if (!order) return res.error(req.t('ERRORS.ORDER_NOT_FOUND'), 404);

        let itemsTotal = 0;
        let itemsSummary = [];
        let totalPaidFlag = false;

        if (splitType === 'by-user' && userId) {
            const unpaidItems = order.items.filter(i => !i.isPaid);
            const hasOrphans = unpaidItems.some(item => !item.orderedBy || !item.orderedBy.id || ['orphan', 'staff', 'pos'].includes(item.orderedBy.id));

            if (hasOrphans) {
                return res.error('Existen platos sin comensal asignado. Asígnalos a un nombre antes de cobrar individualmente.', 400);
            }

            const userItems = unpaidItems.filter(item => item.orderedBy.id === userId);
            if (userItems.length === 0) return res.error('Este comensal no tiene platos pendientes de pago.', 400);

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
        if (totalPaidFlag) {
            order.status = 'completed';
            const restaurant = await Restaurant.findOne();
            if (restaurant) {
                const totem = restaurant.totems.find(t => t.id === order.totemId);
                if (totem) {
                    if (totem.isVirtual) {
                        restaurant.totems = restaurant.totems.filter(t => t.id !== order.totemId);
                    } else {
                        totem.currentSessionId = null;
                    }
                    await restaurant.save();
                }
            }
        }
        await order.save();

        const io = req.app.get('io');
        if (io) {
            io.emit('order-updated', order);
            if (order.status === 'completed') {
                io.emit('session-ended', {
                    totemId: order.totemId,
                    tableNumber: order.tableNumber,
                    sessionId: order.sessionId || null
                });
            }
        }

        res.success({ tickets: generatedTickets, orderStatus: order.status });
    }
);

export default router;
