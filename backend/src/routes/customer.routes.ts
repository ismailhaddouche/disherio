import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { strictLimiter } from '../middlewares/rateLimit';
import { CustomerRepository } from '../repositories/totem.repository';
import { asyncHandler, createError } from '../utils/async-handler';

const router = Router();
const customerRepo = new CustomerRepository();

router.use(authMiddleware);

// Get customers by session
router.get('/session/:sessionId', requirePermission('read', 'Customer'), asyncHandler(async (req, res) => {
  const customers = await customerRepo.findBySessionId(String(req.params.sessionId));
  res.json(customers);
}));

// Create customer
router.post('/', strictLimiter, requirePermission('create', 'Customer'), asyncHandler(async (req, res) => {
  const { session_id, customer_name } = req.body;
  
  if (!session_id || !customer_name) {
    throw createError.badRequest('session_id and customer_name are required');
  }

  const customer = await customerRepo.createCustomer({
    session_id,
    customer_name,
  });
  
  res.status(201).json(customer);
}));

// Delete customer
router.delete('/:id', strictLimiter, requirePermission('delete', 'Customer'), asyncHandler(async (req, res) => {
  const customer = await customerRepo.deleteCustomer(String(req.params.id));
  if (!customer) {
    throw createError.notFound('Customer not found');
  }
  res.status(204).end();
}));

export default router;
