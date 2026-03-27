import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { qrLimiter, qrBruteForceLimiter } from '../middlewares/rateLimit';
import * as TotemController from '../controllers/totem.controller';

const router = Router();

// Public routes: QR menu access with rate limiting to prevent abuse
router.get('/menu/:qr', qrBruteForceLimiter, TotemController.getMenuByQR);
router.get('/menu/:qr/dishes', qrLimiter, TotemController.getMenuDishes);

// Protected routes require authentication
router.use(authMiddleware);

router.get('/', requirePermission('read', 'Totem'), TotemController.listTotems);
router.get('/sessions/active', requirePermission('read', 'TotemSession'), TotemController.getActiveSessions);
router.get('/:id', requirePermission('read', 'Totem'), TotemController.getTotem);
router.post('/', requirePermission('create', 'Totem'), TotemController.createTotem);
router.patch('/:id', requirePermission('update', 'Totem'), TotemController.updateTotem);
router.delete('/:id', requirePermission('delete', 'Totem'), TotemController.deleteTotem);
router.post('/:id/regenerate-qr', requirePermission('update', 'Totem'), TotemController.regenerateQr);
router.post('/:totemId/session', requirePermission('create', 'TotemSession'), TotemController.startSession);

export default router;
