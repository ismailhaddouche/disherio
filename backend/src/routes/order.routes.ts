import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { strictLimiter } from '../middlewares/rateLimit';
import * as OrderController from '../controllers/order.controller';

const router = Router();

router.use(authMiddleware);

router.get('/kitchen', strictLimiter, requirePermission('read', 'KDS'), OrderController.getKitchenItems);
router.get('/service-items', strictLimiter, requirePermission('read', 'ItemOrder'), OrderController.getServiceItems);
router.get('/session/:sessionId', requirePermission('read', 'Order'), OrderController.getSessionItems);
router.post('/', strictLimiter, requirePermission('create', 'Order'), OrderController.createOrder);
router.post('/items', strictLimiter, requirePermission('create', 'ItemOrder'), OrderController.addItem);
router.patch('/items/:id/state', strictLimiter, requirePermission('update', 'ItemOrder'), OrderController.updateItemState);
router.patch('/items/:id/assign', strictLimiter, requirePermission('update', 'ItemOrder'), OrderController.assignItemToCustomer);
router.delete('/items/:id', strictLimiter, requirePermission('delete', 'ItemOrder'), OrderController.deleteItem);
router.post('/payments', strictLimiter, requirePermission('create', 'Payment'), OrderController.createPayment);
router.patch('/payments/:id/ticket', strictLimiter, requirePermission('update', 'Payment'), OrderController.markTicketPaid);

export default router;
