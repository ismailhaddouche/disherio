import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { qrLimiter, qrBruteForceLimiter, strictLimiter } from '../middlewares/rateLimit';
import * as TotemController from '../controllers/totem.controller';
import { validate } from '../middlewares/validate';
import { z } from 'zod';
import { RequestIdSchema } from '@disherio/shared';

const router = Router();
// Ephemeral per-session credential echoed back by the public totem client.
// Required for any session whose session_token has been back-filled.
const sessionTokenField = z.string().trim().max(200).optional();
const customerBody = z.object({
  customer_name: z.string().trim().min(2).max(100),
  session_token: sessionTokenField,
});
const createTotemBody = z.object({
  totem_name: z.string().trim().min(1).max(100),
  totem_type: z.enum(['STANDARD', 'TEMPORARY']),
  totem_start_date: z.coerce.date().optional(),
});
// A totem's type is immutable after creation: allowing it in an update body
// would let TAS promote a TEMPORARY totem to STANDARD, because
// assertCanMutateTotem authorizes against the EXISTING type. Only the mutable
// display fields are accepted here.
const updateTotemBody = createTotemBody.partial().omit({ totem_type: true });
const publicOrderBody = z.object({
  request_id: RequestIdSchema,
  session_id: z.string().regex(/^[a-f\d]{24}$/i),
  customer_id: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  session_token: sessionTokenField,
  items: z.array(z.object({
    dishId: z.string().regex(/^[a-f\d]{24}$/i),
    quantity: z.number().int().min(1).max(50),
    variantId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
    extras: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(50).optional(),
  })).min(1).max(100),
});

// Public routes: QR menu access with rate limiting to prevent abuse
router.get('/menu/:qr', qrBruteForceLimiter, TotemController.getMenuByQR);
router.get('/menu/:qr/dishes', qrLimiter, TotemController.getMenuDishes);
router.post('/menu/:qr/session', qrLimiter, TotemController.getOrCreateSessionByQR);
router.post('/menu/:qr/order', qrLimiter, validate(publicOrderBody), TotemController.createPublicOrder);

// Public customer routes (for totem users without auth)
router.post('/menu/:qr/session/:sessionId/customers', qrLimiter, validate(customerBody), TotemController.createCustomer);
router.get('/menu/:qr/session/:sessionId/customers', qrLimiter, TotemController.getSessionCustomers);

// Public order routes for totem views
router.get('/menu/:qr/session/:sessionId/orders', qrLimiter, TotemController.getSessionOrders);
router.get('/menu/:qr/session/:sessionId/customers/:customerId/orders', qrLimiter, TotemController.getCustomerOrders);

// Protected routes require authentication
router.use(authMiddleware);

router.get('/', requirePermission('read', 'Totem'), TotemController.listTotems);
router.get('/sessions/active', requirePermission('read', 'TotemSession'), TotemController.getActiveSessions);
router.post('/sessions/:sessionId/close', strictLimiter, requirePermission('update', 'TotemSession'), TotemController.closeSession);
router.post('/sessions/:sessionId/reopen', strictLimiter, requirePermission('update', 'TotemSession'), TotemController.reopenSession);
router.post('/sessions/:sessionId/archive', strictLimiter, requirePermission('update', 'TotemSession'), TotemController.archiveSession);
router.post('/sessions/:sessionId/cancel', strictLimiter, requirePermission('update', 'TotemSession'), TotemController.cancelSession);
router.get('/:totemId/sessions', requirePermission('read', 'TotemSession'), TotemController.getTotemSessions);
router.get('/:id', requirePermission('read', 'Totem'), TotemController.getTotem);
router.post('/', strictLimiter, requirePermission('create', 'Totem'), validate(createTotemBody), TotemController.createTotem);
router.patch('/:id', strictLimiter, requirePermission('update', 'Totem'), validate(updateTotemBody), TotemController.updateTotem);
router.delete('/:id', strictLimiter, requirePermission('delete', 'Totem'), TotemController.deleteTotem);
router.post('/:id/regenerate-qr', strictLimiter, requirePermission('update', 'Totem'), TotemController.regenerateQr);
router.post('/:totemId/session', strictLimiter, requirePermission('create', 'TotemSession'), TotemController.startSession);

export default router;
