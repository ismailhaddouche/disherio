import express from 'express';
const router = express.Router();
import Joi from 'joi';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';
import { validate, orderPlacementSchema, mongoIdSchema } from '../middleware/validation.middleware.js';
import { ROLES, ORDER_STATUS, ITEM_STATUS, PAYMENT_STATUS, PAYMENT_METHOD, SPLIT_TYPE } from '../constants.js';
import orderController from '../controllers/order.controller.js';

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

// GET / - List active orders (Restricted to staff)
router.get('/', 
    verifyToken, 
    requireRole(ROLES.ADMIN, ROLES.WAITER, ROLES.KITCHEN, ROLES.POS), 
    orderController.getOrders
);

// GET /table/:tableNumber - Get order for table (Public for Totem)
router.get('/table/:tableNumber', orderController.getOrderByTable);

// GET /session/:sessionId - Get order by session code (Public)
router.get('/session/:sessionId', orderController.getOrderBySession);

// POST /table/:tableNumber/add-items - Waiter adding items (Restricted)
router.post('/table/:tableNumber/add-items',
    verifyToken,
    requireRole(ROLES.ADMIN, ROLES.WAITER, ROLES.POS),
    validate(addItemsSchema),
    orderController.addItems
);

// PATCH /:id/items/:itemId/associate - Restricted to staff
router.patch('/:id/items/:itemId/associate',
    verifyToken,
    requireRole(ROLES.ADMIN, ROLES.WAITER, ROLES.POS),
    validate(mongoIdSchema, 'params'),
    validate(associateSchema),
    orderController.associateItem
);

// POST / - Create or update a table order (Public for Totem Customers)
router.post('/',
    validate(orderPlacementSchema),
    orderController.createOrder
);

// PATCH /:id - Update order (Restricted)
router.patch('/:id',
    verifyToken,
    requireRole(ROLES.ADMIN, ROLES.WAITER, ROLES.KITCHEN, ROLES.POS),
    validate(mongoIdSchema, 'params'),
    validate(orderUpdateSchema),
    orderController.updateOrder
);

// PATCH /:id/items/bulk-status - Bulk status update (Restricted)
router.patch('/:id/items/bulk-status',
    verifyToken,
    requireRole(ROLES.ADMIN, ROLES.KITCHEN),
    validate(mongoIdSchema, 'params'),
    validate(itemStatusSchema),
    orderController.bulkUpdateItemStatus
);

// PATCH /:id/items/:itemId - Status update (Restricted)
router.patch('/:id/items/:itemId',
    verifyToken,
    requireRole(ROLES.ADMIN, ROLES.KITCHEN),
    validate(mongoIdSchema, 'params'),
    validate(itemStatusSchema),
    orderController.updateItemStatus
);

// POST /:id/checkout - Process payment (Restricted)
router.post('/:id/checkout',
    verifyToken,
    requireRole(ROLES.ADMIN, ROLES.POS),
    validate(mongoIdSchema, 'params'),
    validate(checkoutSchema),
    orderController.checkout
);

export default router;