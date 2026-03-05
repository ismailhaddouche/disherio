const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const QRCode = require('qrcode');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const Restaurant = require('../models/Restaurant');
const Ticket = require('../models/Ticket');
const ActivityLog = require('../models/ActivityLog');
const Order = require('../models/Order');
const { verifyToken } = require('../middleware/auth.middleware');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }
    next();
};

// Middleware to ensure admin role
const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: req.t('ERRORS.ACCESS_DENIED_ADMIN') });
    }
    next();
};

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

// GET /restaurant - Get restaurant configuration (single tenant)
router.get('/restaurant', async (req, res) => {
    try {
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

        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /restaurant - Update restaurant configuration
// Only whitelisted fields can be updated to prevent arbitrary field injection
const ALLOWED_RESTAURANT_UPDATE_FIELDS = [
    'name', 'address', 'phone', 'email', 'description',
    'theme', 'billing', 'socials', 'stations', 'defaultLanguage'
];
router.patch('/restaurant', verifyToken, requireAdmin, async (req, res) => {
    try {
        let restaurant = await Restaurant.findOne();
        if (!restaurant) {
            restaurant = new Restaurant({ name: 'Mi Restaurante', slug: 'default' });
        }

        for (const field of ALLOWED_RESTAURANT_UPDATE_FIELDS) {
            if (req.body[field] !== undefined) {
                restaurant[field] = req.body[field];
            }
        }

        await restaurant.save();

        const io = req.app.get('io');
        if (io) {
            io.emit('config-updated', restaurant);
        }

        res.json(restaurant);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /upload-logo - Upload and optimize restaurant logo
router.post('/upload-logo', verifyToken, requireAdmin, upload.single('logo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: req.t('ERRORS.NO_IMAGE_PROVIDED') });

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
        res.json({ url: fileUrl });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper to generate a long alphanumeric session ID with year indicators
const generateSessionId = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
    let result = 'DSH-';
    for (let i = 0; i < 12; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const currentYear = new Date().getFullYear();
    return `${result}-${currentYear}-${currentYear + 1}`;
};

// GET /totems/:id/session - Get active session ID for a totem (no auto-generation)
router.get('/totems/:id/session', async (req, res) => {
    try {
        const totemId = parseInt(req.params.id);
        const restaurant = await Restaurant.findOne();
        if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

        const totem = restaurant.totems.find(t => t.id === totemId);
        if (!totem) return res.status(404).json({ error: 'Totem not found' });
        if (!totem.active) return res.status(403).json({ error: 'Mesa desactivada' });

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

        res.json({
            sessionId: sessionId || null,
            totemId: totem.id,
            tableNumber: totem.name || totem.id.toString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /totems/:id/session - Generate and start a new session for a totem
router.post('/totems/:id/session', async (req, res) => {
    try {
        const totemId = parseInt(req.params.id);
        const restaurant = await Restaurant.findOne();
        if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

        const totem = restaurant.totems.find(t => t.id === totemId);
        if (!totem) return res.status(404).json({ error: 'Totem not found' });
        if (!totem.active) return res.status(403).json({ error: 'Mesa desactivada' });

        let sessionId = totem.currentSessionId;

        // Verify if a real active session already exists
        if (sessionId) {
            const activeOrder = await Order.findOne({ sessionId, status: 'active' });
            if (activeOrder) {
                // Session already started by someone else, return existing
                return res.json({ sessionId, totemId: totem.id, tableNumber: totem.name || totem.id.toString() });
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

        res.json({
            sessionId,
            totemId: totem.id,
            tableNumber: totem.name || totem.id.toString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /totems - List totems
router.get('/totems', async (req, res) => {
    try {
        const restaurant = await Restaurant.findOne();
        if (!restaurant) {
            return res.json([]);
        }
        res.json(restaurant.totems || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /totems - Add a new totem
router.post('/totems',
    [
        body('name').trim().notEmpty().withMessage('El nombre del tótem es obligatorio')
    ],
    validate,
    verifyToken,
    async (req, res, next) => {
        // Allow waiters only if isVirtual is true
        if (req.user.role === 'waiter' && req.body.isVirtual !== true) {
            return res.status(403).json({ error: req.t('ERRORS.ACCESS_DENIED_ADMIN') });
        }
        // If not waiter and not admin, block (though verifyToken/roles usually handled by middleware but here requireAdmin was used)
        if (req.user.role !== 'admin' && req.user.role !== 'waiter') {
            return res.status(403).json({ error: req.t('ERRORS.ACCESS_DENIED_ADMIN') });
        }
        next();
    },
    async (req, res) => {
        try {
            const { name, isVirtual } = req.body;
            let restaurant = await Restaurant.findOne();
            if (!restaurant) {
                restaurant = new Restaurant({ name: 'Mi Restaurante' });
            }

            // CHECK DUPLICATE NAME
            const duplicate = restaurant.totems.find(t => t.name.toLowerCase() === name.toLowerCase());
            if (duplicate) {
                return res.status(400).json({ error: req.t('ERRORS.DUPLICATE_TOTEM_NAME') });
            }

            const newTotem = {
                id: restaurant.nextTotemId,
                name: name,
                active: true,
                isVirtual: isVirtual === true
            };

            restaurant.totems.push(newTotem);
            restaurant.nextTotemId += 1;
            await restaurant.save();

            res.status(201).json(newTotem);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// PATCH /totems/:id - Edit totem
router.patch('/totems/:id',
    [
        param('id').notEmpty().withMessage('ID is required'),
        body('name').trim().notEmpty().withMessage('Name is required')
    ],
    validate,
    verifyToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { name } = req.body;
            let restaurant = await Restaurant.findOne();
            if (!restaurant) return res.status(404).json({ error: req.t('ERRORS.RESTAURANT_NOT_FOUND') });

            const totem = restaurant.totems.find(t => String(t.id) === id);
            if (!totem) return res.status(404).json({ error: req.t('ERRORS.TOTEM_NOT_FOUND') });

            // CHECK DUPLICATE (excluding itself)
            const duplicate = restaurant.totems.find(t => t.name.toLowerCase() === name.toLowerCase() && String(t.id) !== id);
            if (duplicate) return res.status(400).json({ error: req.t('ERRORS.DUPLICATE_TOTEM_NAME') });

            totem.name = name;
            await restaurant.save();

            res.json(totem);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// DELETE /totems/:id - Delete totem
router.delete('/totems/:id',
    [param('id').notEmpty()],
    validate,
    verifyToken,
    async (req, res) => {
        try {
            const { id } = req.params;
            let restaurant = await Restaurant.findOne();
            if (!restaurant) return res.status(404).json({ error: req.t('ERRORS.RESTAURANT_NOT_FOUND') });

            const totem = restaurant.totems.find(t => String(t.id) === id);
            if (!totem) return res.status(404).json({ error: req.t('ERRORS.TOTEM_NOT_FOUND') });

            // Waiter can only delete virtual totems
            if (req.user.role === 'waiter' && !totem.isVirtual) {
                return res.status(403).json({ error: req.t('ERRORS.ACCESS_DENIED_ADMIN') });
            }

            // Only admin or waiter (with check above) can delete
            if (req.user.role !== 'admin' && req.user.role !== 'waiter') {
                return res.status(403).json({ error: req.t('ERRORS.ACCESS_DENIED_ADMIN') });
            }

            restaurant.totems = restaurant.totems.filter(t => String(t.id) !== id);
            await restaurant.save();

            res.json({ message: 'Totem deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// GET /qr/:totemId - Generate QR code image
router.get('/qr/:totemId',
    param('totemId').notEmpty().withMessage('totemId is required'),
    validate,
    async (req, res) => {
        try {
            const { totemId } = req.params;

            // Use DOMAIN from environment or fallback to request host
            let baseUrl;
            if (process.env.DOMAIN) {
                baseUrl = process.env.DOMAIN;
                // Add protocol if missing
                if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
                    const protocol = process.env.INSTALL_MODE === 'local' ? 'http' : 'https';
                    baseUrl = `${protocol}://${baseUrl}`;
                }
            } else {
                // Default fallback if no DOMAIN is configured
                const protocol = process.env.INSTALL_MODE === 'local' ? 'http' : 'https';
                baseUrl = `${protocol}://${req.get('host')}`;
            }

            // Clean baseUrl from trailing slash and construct full URL
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
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// POST /close-shift - Cierre de caja: Clear all active sessions and force reconnects
router.post('/close-shift', verifyToken, requireAdmin, async (req, res) => {
    try {
        const restaurant = await Restaurant.findOne();
        if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

        // 1. Clear all active sessions in totems
        restaurant.totems.forEach(totem => {
            totem.currentSessionId = null;
        });

        await restaurant.save();

        // 2. Close any lingering 'active' orders if necessary? 
        // For now, only clearing sessions as requested to force "put name again"

        const io = req.app.get('io');
        if (io) {
            io.emit('all-sessions-ended', { reason: 'SHIFT_CLOSED' });
        }

        res.json({ message: 'Cierre de caja realizado. Todas las sesiones de clientes han sido liquidadas.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /logs - Create activity log (Restricted to authenticated users)
router.post('/logs',
    verifyToken,
    [
        body('action').trim().notEmpty().withMessage('Action is required'),
        body('userId').trim().notEmpty().withMessage('userId is required')
    ],
    validate,
    async (req, res) => {
        try {
            const log = new ActivityLog(req.body);
            await log.save();
            res.status(201).json(log);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// GET /logs - Get activity logs
router.get('/logs', verifyToken, async (req, res) => {
    try {
        const logs = await ActivityLog.find()
            .sort({ timestamp: -1 })
            .limit(100);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /history - Get closed tickets/orders
router.get('/history', verifyToken, async (req, res) => {
    try {
        const tickets = await Ticket.find()
            .sort({ timestamp: -1 })
            .limit(200);
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /tickets/:ticketId - Delete a ticket
router.delete('/tickets/:ticketId',
    param('ticketId').isMongoId().withMessage('Invalid ticket ID'),
    validate,
    verifyToken,
    async (req, res) => {
        try {
            const ticket = await Ticket.findByIdAndDelete(req.params.ticketId);
            if (!ticket) {
                return res.status(404).json({ error: req.t('ERRORS.TICKET_NOT_FOUND') });
            }
            res.json({ message: 'Ticket deleted' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

module.exports = router;
