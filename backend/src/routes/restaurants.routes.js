import express from 'express';
const router = express.Router();
import Joi from 'joi';
import QRCode from 'qrcode';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Restaurant from '../models/Restaurant.js';
import Ticket from '../models/Ticket.js';
import ActivityLog from '../models/ActivityLog.js';
import AuditService from '../services/audit.service.js';
import Order from '../models/Order.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { validate, mongoIdSchema, restaurantUpdateSchema } from '../middleware/validation.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware to ensure admin role
async function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.error(req.t('ERRORS.ACCESS_DENIED_ADMIN'), 403);
    }
    next();
}

// Configure multer storage (memory storage for sharp processing)
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Solo se permiten imágenes'));
    }
});

// ── Joi Schemas ──────────────────────────────────────────────────────────────

// ── Joi Schemas ──────────────────────────────────────────────────────────────

const totemSchema = Joi.object({
    name: Joi.string().required().min(1).max(50).trim(),
    isVirtual: Joi.boolean().default(false)
}).unknown(false);

const logSchema = Joi.object({
    action: Joi.string().required().max(100).trim(),
    userId: Joi.string().required().max(100).trim(),
    details: Joi.object().optional(),
    tableNumber: Joi.string().max(20).optional()
}).unknown(false);

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /restaurant - Get restaurant configuration (single tenant)
router.get('/restaurant', async function(req, res) {
    let restaurant = await Restaurant.findOne();
    if (!restaurant) {
        restaurant = new Restaurant({
            name: process.env.RESTAURANT_NAME || 'Mi Restaurante'
        });
        await restaurant.save();
    }

    // Inject current domain from ENV to ensure it's always accurate and read-only for frontend
    const config = restaurant.toObject();
    config.domain = process.env.DOMAIN || `http://${req.get('host')}`;

    res.success(config);
});

// PATCH /restaurant - Update restaurant configuration
router.patch('/restaurant',
    verifyToken,
    requireAdmin,
    validate(restaurantUpdateSchema),
    async function(req, res) {
        let restaurant = await Restaurant.findOne();
        if (!restaurant) {
            restaurant = new Restaurant({ name: 'Mi Restaurante', slug: 'default' });
        }

        const ALLOWED_FIELDS = [
            'name', 'address', 'phone', 'email', 'description',
            'theme', 'billing', 'socials', 'stations', 'defaultLanguage'
        ];

        for (const field of ALLOWED_FIELDS) {
            if (req.body[field] !== undefined) {
                restaurant[field] = req.body[field];
            }
        }

        const oldState = restaurant.toObject();
        await restaurant.save();

        await AuditService.logChange(req, 'RESTAURANT_CONFIG_UPDATED', oldState, restaurant.toObject());

        const io = req.app.get('io');
        if (io) io.emit('config-updated', restaurant);

        res.success(restaurant);
    }
);

// POST /upload-logo - Upload and optimize restaurant logo
router.post('/upload-logo',
    verifyToken,
    requireAdmin,
    upload.single('logo'),
    async function(req, res) {
        if (!req.file) return res.error(req.t('ERRORS.NO_IMAGE_PROVIDED'), 400);

        const uploadDir = path.join(__dirname, '../../public/uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

        const filename = `logo-${Date.now()}.webp`;
        const filepath = path.join(uploadDir, filename);

        // Optimize image with sharp: Max 500px, WebP format
        await sharp(req.file.buffer)
            .resize(500, 500, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(filepath);

        // Return the path so the frontend can save it to the config
        const fileUrl = `/uploads/${filename}`;
        res.success({ url: fileUrl });
    }
);

// Helper to generate a long alphanumeric session ID
const generateSessionId = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = 'DSH-';
    for (let i = 0; i < 12; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const currentYear = new Date().getFullYear();
    return `${result}-${currentYear}-${currentYear + 1}`;
};

// GET /totems/:id/session - Get active session ID for a totem
router.get('/totems/:id/session',
    validate(Joi.object({ id: Joi.number().integer().required() }), 'params'),
    async function(req, res) {
        const totemId = parseInt(req.params.id);
        const restaurant = await Restaurant.findOne();
        if (!restaurant) return res.error('Restaurant not found', 404);

        const totem = restaurant.totems.find(t => t.id === totemId);
        if (!totem) return res.error('Totem not found', 404);
        if (!totem.active) return res.error('Mesa desactivada', 403);

        let sessionId = totem.currentSessionId;

        if (sessionId) {
            const activeOrder = await Order.findOne({ sessionId, status: 'active' });
            if (!activeOrder) {
                // Stale session, clear it.
                sessionId = null;
                totem.currentSessionId = null;
                await restaurant.save();
            }
        }

        res.success({
            sessionId: sessionId || null,
            totemId: totem.id,
            tableNumber: totem.name || totem.id.toString()
        });
    }
);

// POST /totems/:id/session - Generate and start a new session for a totem
router.post('/totems/:id/session',
    validate(Joi.object({ id: Joi.number().integer().required() }), 'params'),
    async function(req, res) {
        const totemId = parseInt(req.params.id);
        const restaurant = await Restaurant.findOne();
        if (!restaurant) return res.error('Restaurant not found', 404);

        const totem = restaurant.totems.find(t => t.id === totemId);
        if (!totem) return res.error('Totem not found', 404);
        if (!totem.active) return res.error('Mesa desactivada', 403);

        let sessionId = totem.currentSessionId;

        // Verify if a real active session already exists
        if (sessionId) {
            const activeOrder = await Order.findOne({ sessionId, status: 'active' });
            if (activeOrder) {
                // Session already started by someone else, return existing
                return res.success({ sessionId, totemId: totem.id, tableNumber: totem.name || totem.id.toString() });
            }
        }

        // Generate new session since none exists or it was stale
        sessionId = generateSessionId();
        totem.currentSessionId = sessionId;
        await restaurant.save();

        // Initialize an empty active Order to lock the session
        const newOrder = new Order({
            tableNumber: totem.name || totem.id.toString(),
            totemId: totem.id,
            sessionId: sessionId,
            items: [],
            status: 'active'
        });
        await newOrder.save();

        const io = req.app.get('io');
        if (io) io.emit('order-updated', newOrder); // Notify waiters that a table opened

        res.success({
            sessionId,
            totemId: totem.id,
            tableNumber: totem.name || totem.id.toString()
        });
    }
);

// GET /totems - List totems
router.get('/totems', async function(req, res) {
    const restaurant = await Restaurant.findOne();
    res.success(restaurant?.totems || []);
});

// POST /totems - Add a new totem
router.post('/totems',
    verifyToken,
    validate(totemSchema),
    async function(req, res, next) {
        // Allow waiters only if isVirtual is true
        if (req.user.role === 'waiter' && req.body.isVirtual !== true) {
            return res.error(req.t('ERRORS.ACCESS_DENIED_ADMIN'), 403);
        }
        if (req.user.role !== 'admin' && req.user.role !== 'waiter') {
            return res.error(req.t('ERRORS.ACCESS_DENIED_ADMIN'), 403);
        }
        next();
    },
    async function(req, res) {
        const { name, isVirtual } = req.body;
        let restaurant = await Restaurant.findOne();
        if (!restaurant) {
            restaurant = new Restaurant({ name: 'Mi Restaurante' });
        }

        // CHECK DUPLICATE NAME
        const duplicate = restaurant.totems.find(t => t.name.toLowerCase() === name.toLowerCase());
        if (duplicate) {
            return res.error(req.t('ERRORS.DUPLICATE_TOTEM_NAME'), 400);
        }

        const newTotem = {
            id: restaurant.nextTotemId,
            name: name,
            active: true,
            isVirtual: isVirtual === true,
            createdBy: req.user.username
        };

        restaurant.totems.push(newTotem);
        restaurant.nextTotemId += 1;
        await restaurant.save();

        await AuditService.log(req, 'TOTEM_CREATED', {
            totemId: newTotem.id,
            name: newTotem.name,
            isVirtual: newTotem.isVirtual
        });

        res.success(newTotem, 201);
    }
);

// PATCH /totems/:id - Edit totem
router.patch('/totems/:id',
    verifyToken,
    requireAdmin,
    validate(Joi.object({ id: Joi.string().required() }), 'params'), // Totem IDs are numbers but passed as strings in URL
    validate(totemSchema),
    async function(req, res) {
        const { id } = req.params;
        const { name } = req.body;
        let restaurant = await Restaurant.findOne();
        if (!restaurant) return res.error(req.t('ERRORS.RESTAURANT_NOT_FOUND'), 404);

        const totem = restaurant.totems.find(t => String(t.id) === id);
        if (!totem) return res.error(req.t('ERRORS.TOTEM_NOT_FOUND'), 404);

        // CHECK DUPLICATE (excluding itself)
        const duplicate = restaurant.totems.find(t => t.name.toLowerCase() === name.toLowerCase() && String(t.id) !== id);
        if (duplicate) return res.error(req.t('ERRORS.DUPLICATE_TOTEM_NAME'), 400);

        const oldTotem = { ...totem.toObject() };
        totem.name = name;
        await restaurant.save();

        await AuditService.logChange(req, 'TOTEM_UPDATED', oldTotem, totem.toObject(), {
            totemId: totem.id
        });

        res.success(totem);
    }
);

// DELETE /totems/:id - Delete totem
router.delete('/totems/:id',
    verifyToken,
    validate(Joi.object({ id: Joi.string().required() }), 'params'),
    async function(req, res) {
        const { id } = req.params;
        let restaurant = await Restaurant.findOne();
        if (!restaurant) return res.error(req.t('ERRORS.RESTAURANT_NOT_FOUND'), 404);

        const totem = restaurant.totems.find(t => String(t.id) === id);
        if (!totem) return res.error(req.t('ERRORS.TOTEM_NOT_FOUND'), 404);

        // Waiter can only delete virtual totems
        if (req.user.role === 'waiter' && !totem.isVirtual) {
            return res.error(req.t('ERRORS.ACCESS_DENIED_ADMIN'), 403);
        }

        if (req.user.role !== 'admin' && req.user.role !== 'waiter') {
            return res.error(req.t('ERRORS.ACCESS_DENIED_ADMIN'), 403);
        }

        await AuditService.log(req, 'TOTEM_DELETED', {
            totemId: totem.id,
            name: totem.name,
            isVirtual: totem.isVirtual
        });

        restaurant.totems = restaurant.totems.filter(t => String(t.id) !== id);
        await restaurant.save();

        res.success({ message: 'Totem deleted successfully' });
    }
);

// GET /qr/:totemId - Generate QR code image
router.get('/qr/:totemId',
    validate(Joi.object({ totemId: Joi.string().required() }), 'params'),
    async function(req, res) {
        const { totemId } = req.params;

        let baseUrl;
        if (process.env.DOMAIN) {
            baseUrl = process.env.DOMAIN;
            if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
                const protocol = process.env.INSTALL_MODE === 'local' ? 'http' : 'https';
                baseUrl = `${protocol}://${baseUrl}`;
            }
        } else {
            const protocol = process.env.INSTALL_MODE === 'local' ? 'http' : 'https';
            baseUrl = `${protocol}://${req.get('host')}`;
        }

        baseUrl = baseUrl.replace(/\/+$/, '');
        const customerUrl = `${baseUrl}/${totemId}`;

        const qrBuffer = await QRCode.toBuffer(customerUrl, {
            type: 'png',
            width: 400,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' }
        });

        res.set('Content-Type', 'image/png');
        res.set('Content-Disposition', `inline; filename="qr-${totemId}.png"`);
        res.send(qrBuffer);
    }
);

// POST /close-shift - Cierre de caja
router.post('/close-shift', verifyToken, requireAdmin, async function(req, res) {
    const restaurant = await Restaurant.findOne();
    if (!restaurant) return res.error('Restaurant not found', 404);

    const affectedTables = restaurant.totems.filter(t => t.currentSessionId).map(t => t.name || t.id);

    restaurant.totems.forEach(totem => {
        totem.currentSessionId = null;
    });

    await restaurant.save();

    await AuditService.log(req, 'SHIFT_CLOSED', {
        affectedTablesCount: affectedTables.length,
        affectedTables
    });

    const io = req.app.get('io');
    if (io) {
        // Emitir solo a la sala de clientes (QR/totems), no a admin/POS
        io.to('customer').emit('all-sessions-ended', { reason: 'SHIFT_CLOSED' });
    }

    res.success({ message: 'Cierre de caja realizado. Todas las sesiones de clientes han sido liquidadas.' });
});

// POST /logs - Create activity log (Maintained for legacy frontend logs but secured)
router.post('/logs',
    verifyToken,
    validate(logSchema),
    async function(req, res) {
        // Enforce server-side user info for security
        const auditLog = {
            ...req.body,
            userId: req.user.userId,
            username: req.user.username,
            role: req.user.role
        };
        const log = new ActivityLog(auditLog);
        await log.save();
        res.success(log, 201);
    }
);

// GET /logs - Get activity logs
router.get('/logs', verifyToken, requireAdmin, async function(req, res) {
    const logs = await ActivityLog.find()
        .sort({ timestamp: -1 })
        .limit(200);
    res.success(logs);
});

// GET /history - Get closed tickets/orders
router.get('/history', verifyToken, async function(req, res) {
    const tickets = await Ticket.find()
        .sort({ timestamp: -1 })
        .limit(200);
    res.success(tickets);
});

// DELETE /tickets/:ticketId - Delete a ticket
router.delete('/tickets/:ticketId',
    verifyToken,
    validate(mongoIdSchema.rename('id', 'ticketId'), 'params'),
    async function(req, res) {
        const ticket = await Ticket.findById(req.params.ticketId);
        if (!ticket) return res.error(req.t('ERRORS.TICKET_NOT_FOUND'), 404);

        await AuditService.log(req, 'TICKET_DELETED', {
            ticketId: ticket._id,
            customId: ticket.customId,
            amount: ticket.amount
        });

        await Ticket.findByIdAndDelete(req.params.ticketId);
        res.success({ message: 'Ticket deleted' });
    }
);

export default router;
