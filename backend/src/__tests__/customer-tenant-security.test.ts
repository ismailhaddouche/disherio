import express, { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { createError } from '../utils/async-handler';

const mockFindBySessionId = jest.fn();
const mockCreateCustomer = jest.fn();
const mockFindById = jest.fn();
const mockDeleteCustomer = jest.fn();
const mockAssertSessionInRestaurant = jest.fn();
const mockCreateActiveCustomer = jest.fn();

jest.mock('../repositories/totem.repository', () => ({
  CustomerRepository: jest.fn().mockImplementation(() => ({
    findBySessionId: mockFindBySessionId,
    createCustomer: mockCreateCustomer,
    findById: mockFindById,
    deleteCustomer: mockDeleteCustomer,
  })),
}));
jest.mock('../services/order-ownership.service', () => ({
  assertSessionInRestaurant: mockAssertSessionInRestaurant,
}));
jest.mock('../services/totem.service', () => ({
  createCustomerForActiveSession: mockCreateActiveCustomer,
}));
jest.mock('../middlewares/auth', () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    req.user = {
      staffId: 'staff-a',
      restaurantId: 'restaurant-a',
      role: 'POS',
      permissions: ['POS'],
      name: 'Staff A',
    };
    next();
  },
}));
jest.mock('../middlewares/rbac', () => ({
  requirePermission: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
jest.mock('../middlewares/rateLimit', () => ({
  strictLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

import customerRouter from '../routes/customer.routes';

const SESSION_ID = '507f1f77bcf86cd799439013';
const CUSTOMER_ID = '507f1f77bcf86cd799439015';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/customers', customerRouter);
  app.use((err: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.statusCode ?? 500).json({ error: err.message });
  });
  return app;
}

describe('customer route tenant isolation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('checks session ownership before listing customers', async () => {
    mockFindBySessionId.mockResolvedValue([]);
    await request(createApp()).get(`/api/customers/session/${SESSION_ID}`).expect(200);
    expect(mockAssertSessionInRestaurant).toHaveBeenCalledWith(SESSION_ID, 'restaurant-a');
  });

  it('does not create a customer when the session belongs to another restaurant', async () => {
    mockAssertSessionInRestaurant.mockRejectedValue(createError.forbidden());
    await request(createApp())
      .post('/api/customers')
      .send({ session_id: SESSION_ID, customer_name: 'Guest' })
      .expect(403);
    expect(mockCreateCustomer).not.toHaveBeenCalled();
  });

  it('does not delete a customer when its session belongs to another restaurant', async () => {
    mockFindById.mockResolvedValue({ _id: CUSTOMER_ID, session_id: { toString: () => SESSION_ID } });
    mockAssertSessionInRestaurant.mockRejectedValue(createError.forbidden());
    await request(createApp()).delete(`/api/customers/${CUSTOMER_ID}`).expect(403);
    expect(mockDeleteCustomer).not.toHaveBeenCalled();
  });
});
