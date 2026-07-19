import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { strictLimiter } from '../middlewares/rateLimit';
import { validate } from '../middlewares/validate';
import { CreateCustomerBodySchema } from '@disherio/shared';
import * as CustomerController from '../controllers/customer.controller';

const router = Router();

router.use(authMiddleware);

// Get customers by session
router.get('/session/:sessionId', requirePermission('read', 'Customer'), CustomerController.listSessionCustomers);

// Create customer
router.post('/', strictLimiter, requirePermission('create', 'Customer'), validate(CreateCustomerBodySchema), CustomerController.createCustomer);

// Delete customer
router.delete('/:id', strictLimiter, requirePermission('delete', 'Customer'), CustomerController.deleteCustomer);

export default router;
