import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { strictLimiter } from '../middlewares/rateLimit';
import { CustomerRepository } from '../repositories/totem.repository';
import { asyncHandler, createError } from '../utils/async-handler';
import * as OrderOwnershipService from '../services/order-ownership.service';
import * as TotemService from '../services/totem.service';
import { validate } from '../middlewares/validate';
import { CreateCustomerBodySchema } from '@disherio/shared';

const router = Router();
const customerRepo = new CustomerRepository();

router.use(authMiddleware);

// Get customers by session
router.get('/session/:sessionId', requirePermission('read', 'Customer'), asyncHandler(async (req, res) => {
  const sessionId = String(req.params.sessionId);
  await OrderOwnershipService.assertSessionInRestaurant(sessionId, req.user!.restaurantId);
  const customers = await customerRepo.findBySessionId(sessionId);
  res.json(customers);
}));

// Create customer
router.post('/', strictLimiter, requirePermission('create', 'Customer'), validate(CreateCustomerBodySchema), asyncHandler(async (req, res) => {
  const { session_id, customer_name } = req.body;

  await OrderOwnershipService.assertSessionInRestaurant(session_id, req.user!.restaurantId);

  const customer = await TotemService.createCustomerForActiveSession(session_id, customer_name);

  res.status(201).json(customer);
}));

// Delete customer
router.delete('/:id', strictLimiter, requirePermission('delete', 'Customer'), asyncHandler(async (req, res) => {
  const customerId = String(req.params.id);
  const existingCustomer = await customerRepo.findById(customerId);
  if (!existingCustomer) {
    throw createError.notFound('CUSTOMER_NOT_FOUND');
  }
  await OrderOwnershipService.assertSessionInRestaurant(existingCustomer.session_id.toString(), req.user!.restaurantId);
  const customer = await customerRepo.deleteCustomer(customerId);
  if (!customer) {
    throw createError.notFound('CUSTOMER_NOT_FOUND');
  }
  res.status(204).end();
}));

export default router;
