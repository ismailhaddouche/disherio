import express from 'express';
const router = express.Router();
import Joi from 'joi';
import Order from '../models/Order.js';
import Ticket from '../models/Ticket.js';
import Restaurant from '../models/Restaurant.js';
import OrderService from '../services/order.service.js';
import AuditService from '../services/audit.service.js';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';
import { validate, orderPlacementSchema, mongoIdSchema } from '../middleware/validation.middleware.js';
import { ROLES, ORDER_STATUS, ITEM_STATUS, PAYMENT_STATUS, PAYMENT_METHOD, SPLIT_TYPE, SOCKET_EVENTS } from '../constants.js';

// ── Joi Schemas ──────────────────────────────────────────────────────────────

const addItemsSchema = Joi.object({
    items: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        price: Joi.number().min(0).required(),
        quantity: Joi.number().integer().min(1).required(),
        image: Joi.string().allow('').optional()
    }).unknown(true)).min(1).required(),
    guestId: Joi.string().allow('').optional(),
    guestName: Joi.string().allow('').optional(),
    __v: Joi.number().optional() // OCC support
}).unknown(false);

const associateSchema = Joi.object({
    userId: Joi.string().required(),
    userName: Joi.string().required(),
    __v: Joi.number().required() // OCC support
}).unknown(false);

const orderUpdateSchema = Joi.object({
    status: Joi.string().valid(...Object.values(ORDER_STATUS)),
    paymentStatus: Joi.string().valid(...Object.values(PAYMENT_STATUS)),
    items: Joi.array(),
    totalAmount: Joi.number(),
    __v: Joi.number().required() // Version for optimistic concurrency
}).min(2).unknown(false); // At least __v and one other field

const itemStatusSchema = Joi.object({
    status: Joi.string().valid(...Object.values(ITEM_STATUS)).required(),
    __v: Joi.number().required() // OCC support
}).unknown(false);

const checkoutSchema = Joi.object({
    method: Joi.string().valid(...Object.values(PAYMENT_METHOD)).required(),
    splitType: Joi.string().valid(...Object.values(SPLIT_TYPE)),
    parts: Joi.number().integer().min(1).optional(),
    userId: Joi.string().allow('').optional(),
    itemIds: Joi.array().items(Joi.string()).optional(),
    billingConfig: Joi.object().optional(),
    __v: Joi.number().optional()
}).unknown(false);

// ── Routes ───────────────────────────────────────────────────────────────────

const staffAccess = (...roles) => [verifyToken, requireRole(...roles)];

// GET / - List active orders (Restricted to staff)
router.get('/', verifyToken, requireRole(ROLES.ADMIN, ROLES.WAITER, ROLES.KITCHEN, ROLES.POS), async function(req, res) {
    const orders = await Order.find({ status: ORDER_STATUS.ACTIVE }).sort({ createdAt: -1 });
    res.success(orders);
});

// GET /table/:tableNumber - Get order for table (Public for Totem)
router.get('/table/:tableNumber', async function(req, res) {
    const order = await Order.findOne({
        tableNumber: req.params.tableNumber,
        status: ORDER_STATUS.ACTIVE
    });
    res.success(order || null);
});

// GET /session/:sessionId - Get order by session code (Public)
router.get('/session/:sessionId', async function(req, res) {
    const order = await Order.findOne({
        sessionId: req.params.sessionId,
        status: ORDER_STATUS.ACTIVE
    });
    res.success(order || null);
});

// POST /table/:tableNumber/add-items - Waiter adding items (Restricted)
router.post('/table/:tableNumber/add-items',
    verifyToken,
    requireRole(ROLES.ADMIN, ROLES.WAITER, ROLES.POS),
    validate(addItemsSchema),
    async function(req, res) {
        const { tableNumber } = req.params;
        const { items, guestId, guestName } = req.body;

        let order = await Order.findOne({ tableNumber, status: ORDER_STATUS.ACTIVE });
        if (!order) {
            order = new Order({
                tableNumber,
                totemId: parseInt(tableNumber) || 0,
                items: [],
                totalAmount: 0
            });
        }

        const newItems = items.map(item => ({
            ...item,
            status: ITEM_STATUS.PENDING,
            orderedBy: {
                id: guestId || 'staff',
                name: guestName || req.user.username || 'Personal'
            }
        }));

        order.items.push(...newItems);
        order.totalAmount = OrderService.calculateTotal(order.items);

        if (req.body.__v !== undefined && order.__v !== req.body.__v) {
            return res.error(req.t('ERRORS.VERSION_CONFLICT'), 409);
        }

        try {
            await order.save();
        } catch (error) {
            if (error.name === 'VersionError') {
                return res.error(req.t('ERRORS.ORDER_CONCURRENCY'), 409);
            }
            throw error;
        }

        const io = req.app.get('io');
        if (io) io.emit(SOCKET_EVENTS.ORDER_UPDATED, order);

        res.success(order);
    }
);

// PATCH /:id/items/:itemId/associate - Restricted to staff
router.patch('/:id/items/:itemId/associate',
    verifyToken,
    requireRole(ROLES.ADMIN, ROLES.WAITER, ROLES.POS),
    validate(mongoIdSchema, 'params'),
    validate(associateSchema),
    async function(req, res) {
        const order = await Order.findById(req.params.id);
        if (!order) return res.error(req.t('ERRORS.ORDER_NOT_FOUND'), 404);

        const item = order.items.id(req.params.itemId) || order.items.find(i => String(i._id) === req.params.itemId);
        if (!item) return res.error(req.t('ERRORS.ITEM_NOT_FOUND'), 404);

        const oldBy = item.orderedBy ? { ...item.orderedBy } : null;
        item.orderedBy = { id: req.body.userId, name: req.body.userName };
        
        if (req.body.__v !== undefined && order.__v !== req.body.__v) {
            return res.error(req.t('ERRORS.VERSION_CONFLICT') || 'Version conflict detected.', 409);
        }

        try {
            await order.save();

            await AuditService.log(req, 'ORDER_ITEM_ASSOCIATED', {
                orderId: order._id,
                tableNumber: order.tableNumber,
                itemId: item._id,
                itemName: item.name,
                from: oldBy,
                to: item.orderedBy
            });
        } catch (error) {
            if (error.name === 'VersionError') {
                return res.error(req.t('ERRORS.ORDER_CONCURRENCY'), 409);
            }
            throw error;
        }

        const io = req.app.get('io');
        if (io) io.emit(SOCKET_EVENTS.ORDER_UPDATED, order);

        res.success(order);
    }
);

// POST / - Create or update a table order (Public for Totem Customers)
router.post('/',
    validate(orderPlacementSchema),
    async function(req, res) {
        const { tableNumber, totemId, sessionId, items } = req.body;
        const numericTotemId = Number(totemId);

        if (!Number.isInteger(numericTotemId)) {
            return res.error(req.t('ERRORS.INVALID_TOTEM_ID') || 'Invalid totem identifier', 400);
        }

        if (!sessionId) {
            return res.error(req.t('ERRORS.SESSION_REQUIRED') || 'Session is required to place orders', 400);
        }

        const restaurant = await Restaurant.findOne();
        if (!restaurant) {
            return res.error(req.t('ERRORS.RESTAURANT_NOT_FOUND'), 404);
        }

        const totem = restaurant.totems.find(t => t.id === numericTotemId);
        if (!totem) {
            return res.error(req.t('ERRORS.TOTEM_NOT_FOUND'), 404);
        }

        if (!totem.active) {
            return res.error(req.t('ERRORS.TOTEM_INACTIVE'), 403);
        }

        if (!totem.currentSessionId || totem.currentSessionId !== sessionId) {
            return res.error(req.t('ERRORS.SESSION_INVALID'), 409);
        }

        const tNumber = tableNumber || String(totem.name || numericTotemId);

        let order = await Order.findOne({ sessionId: sessionId, status: ORDER_STATUS.ACTIVE });
        if (!order) {
            order = new Order({ tableNumber: tNumber, totemId: numericTotemId, sessionId: sessionId, items: [], totalAmount: 0 });
        }

        const taggedItems = items.map(item => ({
            ...item,
            status: ITEM_STATUS.PENDING,
            orderedBy: {
                id: req.user?.userId || 'guest',
                name: req.user?.username || 'Invitado'
            }
        }));

        order.items.push(...taggedItems);
        order.totalAmount = OrderService.calculateTotal(order.items);
        
        try {
            await order.save();
        } catch (error) {
            if (error.name === 'VersionError') {
                return res.error(req.t('ERRORS.ORDER_CONCURRENCY'), 409);
            }
            throw error;
        }

        const io = req.app.get('io');
        if (io) io.emit(SOCKET_EVENTS.ORDER_UPDATED, order);

        res.success(order, undefined, 201);
    }
);

// PATCH /:id - Update order (Restricted)
router.patch('/:id',
    verifyToken,
    requireRole(ROLES.ADMIN, ROLES.WAITER, ROLES.KITCHEN, ROLES.POS),
    validate(mongoIdSchema, 'params'),
    validate(orderUpdateSchema),
    async function(req, res) {
        const ALLOWED = ['status', 'paymentStatus', 'items', 'totalAmount'];
        const updateData = {};
        for (const field of ALLOWED) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }

        const order = await Order.findById(req.params.id);
        if (!order) return res.error(req.t('ERRORS.ORDER_NOT_FOUND'), 404);

        // If status is being updated, use the service to record history
        if (updateData.status) {
            await OrderService.updateOrderStatus(order, updateData.status);
        }
        
        // Remove status from manual update to avoid double update
        delete updateData.status;

        if (req.body.__v !== undefined && order.__v !== req.body.__v) {
            return res.error(req.t('ERRORS.VERSION_CONFLICT') || 'Version conflict detected.', 409);
        }
        
        const oldState = order.toObject();
        Object.assign(order, updateData);
        
        try {
            await order.save();
            
            // Log if items or totals changed (audit manual overrides in POS)
            if (updateData.items || updateData.totalAmount) {
                await AuditService.logChange(req, 'ORDER_MANUALLY_UPDATED', oldState, order.toObject(), {
                    orderId: order._id,
                    tableNumber: order.tableNumber
                });
            }
        } catch (error) {
            if (error.name === 'VersionError') {
                return res.error(req.t('ERRORS.ORDER_CONCURRENCY'), 409);
            }
            throw error;
        }

        const io = req.app.get('io');
        if (io) io.emit(SOCKET_EVENTS.ORDER_UPDATED, order);

        res.success(order);
    }
);

// PATCH /:id/items/bulk-status - Bulk status update (Restricted)
router.patch('/:id/items/bulk-status',
    verifyToken,
    requireRole(ROLES.ADMIN, ROLES.KITCHEN),
    validate(mongoIdSchema, 'params'),
    validate(itemStatusSchema),
    async function(req, res) {
        const order = await Order.findById(req.params.id);
        if (!order) return res.error(req.t('ERRORS.ORDER_NOT_FOUND'), 404);

        const previousItems = order.items.map(i => ({ id: i._id.toString(), status: i.status }));
        for (const item of order.items) {
            if (item.status !== ITEM_STATUS.SERVED && item.status !== ITEM_STATUS.CANCELLED) {
                item.status = req.body.status;
            }
        }

        try {
            if (req.body.__v !== undefined && order.__v !== req.body.__v) {
                return res.error(req.t('ERRORS.VERSION_CONFLICT'), 409);
            }

            await order.save();
            
            await AuditService.log(req, 'ORDER_ITEMS_BULK_STATUS_CHANGED', {
                orderId: order._id,
                tableNumber: order.tableNumber,
                status: req.body.status,
                affectedItems: previousItems.filter(i => i.status !== req.body.status).map(i => i.id)
            });
        } catch (error) {
            if (error.name === 'VersionError') {
                return res.error(req.t('ERRORS.ORDER_CONCURRENCY'), 409);
            }
            throw error;
        }

        const io = req.app.get('io');
        if (io) io.emit(SOCKET_EVENTS.ORDER_UPDATED, order);

        res.success(order);
    }
);

// PATCH /:id/items/:itemId - Status update (Restricted)
router.patch('/:id/items/:itemId',
    verifyToken,
    requireRole(ROLES.ADMIN, ROLES.KITCHEN),
    validate(mongoIdSchema, 'params'),
    validate(itemStatusSchema),
    async function(req, res) {
        const order = await Order.findById(req.params.id);
        if (!order) return res.error(req.t('ERRORS.ORDER_NOT_FOUND'), 404);

        const item = order.items.id(req.params.itemId);
        const previousStatus = item?.status;

        try {
            await OrderService.updateItemStatus(order, req.params.itemId, req.body.status);
            
            await AuditService.log(req, 'ORDER_ITEM_STATUS_CHANGED', {
                orderId: order._id,
                tableNumber: order.tableNumber,
                itemId: req.params.itemId,
                itemName: item?.name,
                from: previousStatus,
                to: req.body.status
            });
        } catch (error) {
            if (error.name === 'VersionError') {
                return res.error(req.t('ERRORS.ITEM_CONCURRENCY'), 409);
            }
            throw error;
        }

        const io = req.app.get('io');
        if (io) io.emit(SOCKET_EVENTS.ORDER_UPDATED, order);

        res.success(order);
    }
);

// POST /:id/checkout - Process payment (Restricted)
router.post('/:id/checkout',
    verifyToken,
    requireRole(ROLES.ADMIN, ROLES.POS),
    validate(mongoIdSchema, 'params'),
    validate(checkoutSchema),
    async function(req, res) {
        const { splitType, parts, method, billingConfig, itemIds, userId } = req.body;
        const order = await Order.findById(req.params.id);
        if (!order) return res.error(req.t('ERRORS.ORDER_NOT_FOUND'), 404);

        // Validations for complex split types
        if (splitType === 'by-user' && userId) {
            const unpaidItems = order.items.filter(i => !i.isPaid);
            const hasOrphans = unpaidItems.some(item => !item.orderedBy || !item.orderedBy.id || ['orphan', 'staff', 'pos'].includes(item.orderedBy.id));
            if (hasOrphans) {
                return res.error(req.t('ERRORS.ITEMS_WITHOUT_OWNER'), 400);
            }
        }

        // Use service for core checkout logic
        const { finalAmount, baseAmount, vatAmount, vatPercentage, tipAmount, itemsSummary, totalPaidFlag, ticketCount } = OrderService.processCheckout(order, {
            splitType, parts, itemIds, userId, billingConfig
        });

        if (finalAmount <= 0 && splitType !== 'equal') {
            return res.error(req.t('ERRORS.TICKET_CALCULATION_ERROR'), 400);
        }

        const generatedTickets = [];
        for (let i = 0; i < ticketCount; i++) {
            const ticket = new Ticket({
                orderId: order._id,
                customId: `${order._id.toString().slice(-6).toUpperCase()}/${i + 1}-${ticketCount}`,
                method: method || PAYMENT_METHOD.CASH,
                amount: finalAmount,
                baseAmount,
                vatAmount,
                vatPercentage,
                tipAmount,
                itemsSummary
            });
            await ticket.save();
            generatedTickets.push(ticket);
        }

        if (req.body.__v !== undefined && order.__v !== req.body.__v) {
            return res.error(req.t('ERRORS.VERSION_CONFLICT') || 'Version conflict detected.', 409);
        }

        order.paymentStatus = totalPaidFlag ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.SPLIT;

        if (totalPaidFlag) {
            try {
                OrderService.updateOrderStatus(order, ORDER_STATUS.COMPLETED);
                await order.save();
            } catch (error) {
                if (error.name === 'VersionError') {
                    return res.error(req.t('ERRORS.ORDER_CONCURRENCY'), 409);
                }
                throw error;
            }
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
        } else {
            try {
                await order.save();
            } catch (error) {
                if (error.name === 'VersionError') {
                    return res.error(req.t('ERRORS.ORDER_CONCURRENCY'), 409);
                }
                throw error;
            }
        }

        const io = req.app.get('io');
        if (io) {
            io.emit(SOCKET_EVENTS.ORDER_UPDATED, order);
            if (order.status === ORDER_STATUS.COMPLETED) {
                io.emit(SOCKET_EVENTS.SESSION_ENDED, {
                    totemId: order.totemId,
                    tableNumber: order.tableNumber,
                    sessionId: order.sessionId || null
                });
            }
        }

        await AuditService.log(req, 'ORDER_CHECKOUT', {
            orderId: order._id,
            tableNumber: order.tableNumber,
            amount: generatedTickets.reduce((sum, t) => sum + t.amount, 0),
            method: method || PAYMENT_METHOD.CASH,
            splitType,
            status: order.status
        });

        res.success({ tickets: generatedTickets, orderStatus: order.status });
    }
);

export default router;
