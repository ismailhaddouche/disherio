import express from 'express';
const router = express.Router();
import Joi from 'joi';
import Order from '../models/Order.js';
import Ticket from '../models/Ticket.js';
import Restaurant from '../models/Restaurant.js';
import OrderService from '../services/order.service.js';
import AuditService from '../services/audit.service.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { validate, orderPlacementSchema, mongoIdSchema } from '../middleware/validation.middleware.js';

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
    totalAmount: Joi.number(),
    __v: Joi.number().required() // Version for optimistic concurrency
}).min(2); // At least __v and one other field

const itemStatusSchema = Joi.object({
    status: Joi.string().valid('pending', 'preparing', 'ready', 'served', 'cancelled').required()
});

const checkoutSchema = Joi.object({
    method: Joi.string().valid('cash', 'card').required(),
    splitType: Joi.string().valid('equal', 'single', 'by-item', 'by-user'),
    parts: Joi.number().integer().min(1),
    userId: Joi.string().allow(''),
    itemIds: Joi.array().items(Joi.string()),
    billingConfig: Joi.object().unknown(true),
    __v: Joi.number().required()
}).unknown(true);

// ── Routes ───────────────────────────────────────────────────────────────────

// GET / - List active orders (Restricted to staff)
router.get('/', verifyToken, async function(req, res) {
    const orders = await Order.find({ status: 'active' }).sort({ createdAt: -1 });
    res.success(orders);
});

// GET /table/:tableNumber - Get order for table (Public for Totem)
router.get('/table/:tableNumber', async function(req, res) {
    const order = await Order.findOne({
        tableNumber: req.params.tableNumber,
        status: 'active'
    });
    res.success(order || null);
});

// GET /session/:sessionId - Get order by session code (Public)
router.get('/session/:sessionId', async function(req, res) {
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
    async function(req, res) {
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

        const newItems = items.map(item => ({
            ...item,
            status: 'pending',
            orderedBy: {
                id: guestId || 'staff',
                name: guestName || req.user.username || 'Personal'
            }
        }));

        order.items.push(...newItems);
        order.totalAmount = OrderService.calculateTotal(order.items);
        await order.save();

        const io = req.app.get('io');
        if (io) io.emit('order-updated', order);

        res.success(order);
    }
);

// PATCH /:orderId/items/:itemId/associate - Restricted to staff
router.patch('/:orderId/items/:itemId/associate',
    verifyToken,
    validate(mongoIdSchema, 'params'),
    validate(associateSchema),
    async function(req, res) {
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
    async function(req, res) {
        const { tableNumber, totemId, sessionId, items } = req.body;
        const tId = totemId;
        const tNumber = tableNumber || String(tId);

        let order = await Order.findOne({ sessionId: sessionId, status: 'active' });
        if (!order) {
            order = new Order({ tableNumber: tNumber, totemId: tId, sessionId: sessionId, items: [], totalAmount: 0 });
        }

        const taggedItems = items.map(item => ({
            ...item,
            status: 'pending',
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
                return res.error('Error de concurrencia al procesar el pedido. Por favor, inténtelo de nuevo.', 409);
            }
            throw error;
        }

        const io = req.app.get('io');
        if (io) io.emit('order-updated', order);

        res.success(order, 201);
    }
);

// PATCH /:orderId - Update order (Restricted)
router.patch('/:orderId',
    verifyToken,
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

        const order = await Order.findById(req.params.orderId);
        if (!order) return res.error(req.t('ERRORS.ORDER_NOT_FOUND'), 404);

        // If status is being updated, use the service to record history
        if (updateData.status) {
            await OrderService.updateOrderStatus(order, updateData.status);
        }
        
        // Remove status from manual update to avoid double update
        delete updateData.status;

        // Apply __v for OCC
        order.__v = req.body.__v;
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
                return res.error('Conflicto de concurrencia: El pedido ha sido actualizado por otro usuario. Por favor, recarga los datos.', 409);
            }
            throw error;
        }

        const io = req.app.get('io');
        if (io) io.emit('order-updated', order);

        res.success(order);
    }
);

// PATCH /:orderId/items/bulk-status - Bulk status update (Restricted)
router.patch('/:orderId/items/bulk-status',
    verifyToken,
    validate(mongoIdSchema, 'params'),
    validate(itemStatusSchema),
    async function(req, res) {
        const order = await Order.findById(req.params.orderId);
        if (!order) return res.error(req.t('ERRORS.ORDER_NOT_FOUND'), 404);

        for (const item of order.items) {
            if (item.status !== 'served' && item.status !== 'cancelled') {
                item.status = req.body.status;
            }
        }

        try {
            await order.save();
        } catch (error) {
            if (error.name === 'VersionError') {
                return res.error('Conflicto de concurrencia: El pedido ha cambiado durante la actualización masiva.', 409);
            }
            throw error;
        }

        const io = req.app.get('io');
        if (io) io.emit('order-updated', order);

        res.success(order);
    }
);

// PATCH /:orderId/items/:itemId - Status update (Restricted)
router.patch('/:orderId/items/:itemId',
    verifyToken,
    validate(mongoIdSchema, 'params'),
    validate(itemStatusSchema),
    async function(req, res) {
        const order = await Order.findById(req.params.orderId);
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
                return res.error('Conflicto de concurrencia en cocina: El pedido ha cambiado. Sincronizando...', 409);
            }
            throw error;
        }

        const io = req.app.get('io');
        if (io) io.emit('order-updated', order);

        res.success(order);
    }
);

// POST /:orderId/checkout - Process payment (Restricted)
router.post('/:orderId/checkout',
    verifyToken,
    validate(mongoIdSchema, 'params'),
    validate(checkoutSchema),
    async function(req, res) {
        const { splitType, parts, method, billingConfig, itemIds, userId } = req.body;
        const order = await Order.findById(req.params.orderId);
        if (!order) return res.error(req.t('ERRORS.ORDER_NOT_FOUND'), 404);

        // Validations for complex split types
        if (splitType === 'by-user' && userId) {
            const unpaidItems = order.items.filter(i => !i.isPaid);
            const hasOrphans = unpaidItems.some(item => !item.orderedBy || !item.orderedBy.id || ['orphan', 'staff', 'pos'].includes(item.orderedBy.id));
            if (hasOrphans) {
                return res.error('Existen platos sin comensal asignado. Asígnalos a un nombre antes de cobrar individualmente.', 400);
            }
        }

        // Use service for core checkout logic
        const { finalAmount, baseAmount, vatAmount, vatPercentage, tipAmount, itemsSummary, totalPaidFlag, ticketCount } = OrderService.processCheckout(order, {
            splitType, parts, itemIds, userId, billingConfig
        });

        if (finalAmount <= 0 && splitType !== 'equal') {
            return res.error('Error en el cálculo del importe del ticket.', 400);
        }

        const generatedTickets = [];
        for (let i = 0; i < ticketCount; i++) {
            const ticket = new Ticket({
                orderId: order._id,
                customId: `${order._id.toString().slice(-6).toUpperCase()}/${i + 1}-${ticketCount}`,
                method: method || 'cash',
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

        order.paymentStatus = totalPaidFlag ? 'paid' : 'split';
        order.__v = req.body.__v; // Apply version for OCC

        if (totalPaidFlag) {
            try {
                await OrderService.updateOrderStatus(order, 'completed');
            } catch (error) {
                if (error.name === 'VersionError') {
                    return res.error('Error al finalizar: El pedido ha cambiado. Por favor, actualice la cuenta.', 409);
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
            order.__v = req.body.__v;
            try {
                await order.save();
            } catch (error) {
                if (error.name === 'VersionError') {
                    return res.error('Error al cobrar: El pedido ha cambiado. Por favor, actualice la cuenta.', 409);
                }
                throw error;
            }
        }

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

        await AuditService.log(req, 'ORDER_CHECKOUT', {
            orderId: order._id,
            tableNumber: order.tableNumber,
            amount: generatedTickets.reduce((sum, t) => sum + t.amount, 0),
            method: method || 'cash',
            splitType,
            status: order.status
        });

        res.success({ tickets: generatedTickets, orderStatus: order.status });
    }
);

export default router;
