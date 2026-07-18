import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { strictLimiter } from '../middlewares/rateLimit';
import * as OrderController from '../controllers/order.controller';
import { validate } from '../middlewares/validate';
import { CreateOrderRequestSchema, AddItemRequestSchema, BatchItemsRequestSchema, ItemStateRequestSchema, AssignItemRequestSchema, PaymentRequestSchema, TicketRequestSchema } from '../schemas/order.schema';

const router = Router();

router.use(authMiddleware);

router.get('/kitchen', requirePermission('read', 'KDS'), OrderController.getKitchenItems);
router.get('/service-items', requirePermission('read', 'ItemOrder'), OrderController.getServiceItems);
router.get('/session/:sessionId', requirePermission('read', 'Order'), OrderController.getSessionItems);
router.post('/', strictLimiter, requirePermission('create', 'Order'), validate(CreateOrderRequestSchema), OrderController.createOrder);
router.post('/items', strictLimiter, requirePermission('create', 'ItemOrder'), validate(AddItemRequestSchema), OrderController.addItem);
router.post('/items/batch', strictLimiter, requirePermission('create', 'ItemOrder'), validate(BatchItemsRequestSchema), OrderController.addBatchItems);
router.patch('/items/:id/state', strictLimiter, requirePermission('update', 'ItemOrder'), validate(ItemStateRequestSchema), OrderController.updateItemState);
router.patch('/items/:id/assign', strictLimiter, requirePermission('update', 'ItemOrder'), validate(AssignItemRequestSchema), OrderController.assignItemToCustomer);
router.delete('/items/:id', strictLimiter, requirePermission('delete', 'ItemOrder'), OrderController.deleteItem);
router.get('/payments/history', requirePermission('read', 'Payment'), OrderController.getPaymentHistory);
router.post('/payments', strictLimiter, requirePermission('create', 'Payment'), validate(PaymentRequestSchema), OrderController.createPayment);
router.patch('/payments/:id/ticket', strictLimiter, requirePermission('update', 'Payment'), validate(TicketRequestSchema), OrderController.markTicketPaid);

export default router;
