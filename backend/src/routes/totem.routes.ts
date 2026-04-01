import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { qrLimiter, qrBruteForceLimiter, strictLimiter } from '../middlewares/rateLimit';
import * as TotemController from '../controllers/totem.controller';

const router = Router();

// Public routes: QR menu access with rate limiting to prevent abuse
router.get('/menu/:qr', qrBruteForceLimiter, TotemController.getMenuByQR);
router.get('/menu/:qr/dishes', qrLimiter, TotemController.getMenuDishes);
router.post('/menu/:qr/session', qrLimiter, TotemController.getOrCreateSessionByQR);
router.post('/menu/:qr/order', qrLimiter, TotemController.createPublicOrder);

// Public customer routes (for totem users without auth)
router.post('/session/:sessionId/customers', qrLimiter, TotemController.createCustomer);
router.get('/session/:sessionId/customers', qrLimiter, TotemController.getSessionCustomers);

// Public order routes for totem views
router.get('/session/:sessionId/orders', qrLimiter, TotemController.getSessionOrders);
router.get('/customer/:customerId/orders', qrLimiter, TotemController.getCustomerOrders);

// Protected routes require authentication
router.use(authMiddleware);

router.get('/', requirePermission('read', 'Totem'), TotemController.listTotems);
router.get('/sessions/active', requirePermission('read', 'TotemSession'), TotemController.getActiveSessions);
router.get('/:id', requirePermission('read', 'Totem'), TotemController.getTotem);
router.post('/', strictLimiter, requirePermission('create', 'Totem'), TotemController.createTotem);
router.patch('/:id', strictLimiter, requirePermission('update', 'Totem'), TotemController.updateTotem);
router.delete('/:id', strictLimiter, requirePermission('delete', 'Totem'), TotemController.deleteTotem);
router.post('/:id/regenerate-qr', strictLimiter, requirePermission('update', 'Totem'), TotemController.regenerateQr);
router.post('/:totemId/session', strictLimiter, requirePermission('create', 'TotemSession'), TotemController.startSession);

export default router;
