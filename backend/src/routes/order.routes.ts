import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import * as OrderController from '../controllers/order.controller';

const router = Router();

router.use(authMiddleware);

// BUG-05: KDS needs to load all active kitchen items on page mount, not just listen to WS
router.get('/kitchen', requirePermission('read', 'KDS'), OrderController.getKitchenItems);
router.get('/service-items', requirePermission('read', 'ItemOrder'), OrderController.getServiceItems);
router.get('/session/:sessionId', requirePermission('read', 'Order'), OrderController.getSessionItems);
router.post('/', requirePermission('create', 'Order'), OrderController.createOrder);
router.post('/items', requirePermission('create', 'ItemOrder'), OrderController.addItem);
router.patch('/items/:id/state', requirePermission('update', 'ItemOrder'), OrderController.updateItemState);
router.patch('/items/:id/assign', requirePermission('update', 'ItemOrder'), OrderController.assignItemToCustomer);
router.delete('/items/:id', requirePermission('delete', 'ItemOrder'), OrderController.deleteItem);
router.post('/payments', requirePermission('create', 'Payment'), OrderController.createPayment);
router.patch('/payments/:id/ticket', requirePermission('update', 'Payment'), OrderController.markTicketPaid);

export default router;
