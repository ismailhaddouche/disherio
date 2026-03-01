const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.routes');
const orderRoutes = require('./orders.routes');
const menuRoutes = require('./menu.routes');
const restaurantRoutes = require('./restaurants.routes');
const userRoutes = require('./users.routes');

// Health Check - includes deployment info for frontend config
router.get('/health', (req, res) => {
    const rawDomain = process.env.DOMAIN || req.get('host');
    const installMode = process.env.INSTALL_MODE || 'local';
    let baseUrl;
    if (rawDomain.startsWith('http://') || rawDomain.startsWith('https://')) {
        baseUrl = rawDomain;
    } else {
        const protocol = installMode === 'local' ? 'http' : 'https';
        baseUrl = `${protocol}://${rawDomain}`;
    }
    res.status(200).json({
        status: 'ok',
        domain: rawDomain,
        installMode,
        baseUrl
    });
});

// Mount Routes - Explicit prefixes for core entities, global for single-tenant config
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/orders', orderRoutes);
router.use('/menu', menuRoutes);
router.use('/', restaurantRoutes); // Mounted at root since it contains global settings, totems, and history

module.exports = router;
