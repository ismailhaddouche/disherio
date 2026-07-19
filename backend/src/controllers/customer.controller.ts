import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler';
import * as CustomerService from '../services/customer.service';

export const listSessionCustomers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const customers = await CustomerService.listSessionCustomers(
    String(req.params.sessionId),
    req.user!.restaurantId
  );
  res.json(customers);
});

export const createCustomer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { session_id, customer_name } = req.body;
  const customer = await CustomerService.createCustomer(session_id, customer_name, req.user!.restaurantId);
  res.status(201).json(customer);
});

export const deleteCustomer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await CustomerService.deleteCustomer(String(req.params.id), req.user!.restaurantId);
  res.status(204).end();
});
