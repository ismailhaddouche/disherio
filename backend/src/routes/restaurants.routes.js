const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const QRCode = require('qrcode');
const Restaurant = require('../models/Restaurant');
const Ticket = require('../models/Ticket');
const ActivityLog = require('../models/ActivityLog');
const { verifyToken } = require('../middleware/auth.middleware');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }
    next();
};

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
        res.json(restaurant);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /restaurant - Update restaurant configuration
router.patch('/restaurant', verifyToken, async (req, res) => {
    try {
        let restaurant = await Restaurant.findOne();
        if (!restaurant) {
            restaurant = new Restaurant(req.body);
        } else {
            Object.assign(restaurant, req.body);
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
    body('name').optional().trim(),
    verifyToken,
    async (req, res) => {
        try {
            let restaurant = await Restaurant.findOne();
            if (!restaurant) {
                restaurant = new Restaurant({
                    name: process.env.RESTAURANT_NAME || 'Mi Restaurante'
                });
            }

            const newTotem = {
                id: restaurant.nextTotemId,
                name: req.body.name || `Mesa ${restaurant.nextTotemId}`,
                active: true
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

// GET /qr/:totemId - Generate QR code image
router.get('/qr/:totemId',
    param('totemId').notEmpty().withMessage('totemId is required'),
    validate,
    async (req, res) => {
        try {
            const { totemId } = req.params;

            const rawDomain = process.env.DOMAIN || req.get('host');
            let baseUrl;
            if (rawDomain.startsWith('http://') || rawDomain.startsWith('https://')) {
                baseUrl = rawDomain;
            } else {
                const protocol = process.env.INSTALL_MODE === 'local' ? 'http' : 'https';
                baseUrl = `${protocol}://${rawDomain}`;
            }

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

// POST /logs - Create activity log
router.post('/logs',
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
                return res.status(404).json({ error: 'Ticket not found' });
            }
            res.json({ message: 'Ticket deleted' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

module.exports = router;
