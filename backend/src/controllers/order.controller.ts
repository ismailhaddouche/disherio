import { Request, Response } from 'express';
import { asyncHandler, createError } from '../utils/async-handler';
import { ErrorCode } from '@disherio/shared';
import * as OrderService from '../services/order.service';
import * as OrderOwnershipService from '../services/order-ownership.service';
import { PaymentHistoryQuerySchema } from '../schemas/order.schema';

function staffActivitySource(permissions: string[]): 'POS' | 'TAS' {
  return permissions.includes('TAS') && !permissions.includes('POS') ? 'TAS' : 'POS';
}

function transitionActivitySource(permissions: string[]): 'KDS' | 'POS' | 'TAS' {
  if (permissions.includes('POS') || permissions.includes('ADMIN')) return 'POS';
  if (permissions.includes('TAS')) return 'TAS';
  return 'KDS';
}

export const createOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { session_id } = req.body;
  await OrderOwnershipService.assertSessionInRestaurant(session_id, req.user!.restaurantId);
  const order = await OrderService.createOrder(session_id, req.user!.staffId);
  res.status(201).json(order);
});

export const addItem = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { request_id, order_id, session_id, dish_id, customer_id, variant_id, extras } = req.body;
  await OrderOwnershipService.assertSessionInRestaurant(session_id, req.user!.restaurantId);
  const item = await OrderService.addItemToOrder(
    order_id,
    session_id,
    dish_id,
    customer_id,
    variant_id,
    extras,
    staffActivitySource(req.user!.permissions),
    req.user!.staffId,
    request_id
  );
  res.status(201).json(item);
});

export const addBatchItems = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { request_id, session_id, items, as_served } = req.body;
  await OrderOwnershipService.assertSessionInRestaurant(session_id, req.user!.restaurantId);
  const result = await OrderService.addBatchItems(
    session_id,
    req.user!.staffId,
    items,
    request_id,
    as_served === true,
    staffActivitySource(req.user!.permissions)
  );
  res.status(201).json(result);
});

export const updateItemState = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { state } = req.body;
  await OrderOwnershipService.assertItemInRestaurant(String(req.params.id), req.user!.restaurantId);
  const item = await OrderService.updateItemState(
    String(req.params.id),
    state,
    req.user!.staffId,
    req.user!.permissions,
    transitionActivitySource(req.user!.permissions)
  );
  res.json(item);
});

export const getKitchenItems = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const items = await OrderService.getKitchenItems(req.user!.restaurantId);
  res.json(items);
});

export const getSessionItems = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const sessionId = String(req.params.sessionId);
  await OrderOwnershipService.assertSessionInRestaurant(sessionId, req.user!.restaurantId);
  const items = await OrderService.getSessionItems(sessionId);
  res.json(items);
});

export const createPayment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { session_id, payment_type, parts, tips } = req.body;
  await OrderOwnershipService.assertSessionInRestaurant(session_id, req.user!.restaurantId);
  const payment = await OrderService.createPayment(session_id, payment_type, parts, tips);
  res.status(201).json(payment);
});

export const getPaymentHistory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = PaymentHistoryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw createError.badRequest(ErrorCode.VALIDATION_ERROR);
  }
  const { from, to, search, limit } = parsed.data;

  const payments = await OrderService.getPaymentHistory(req.user!.restaurantId, {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    search,
    limit,
  });

  res.json(payments);
});

export const markTicketPaid = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { ticket_part } = req.body;
  const paymentId = String(req.params.id);
  await OrderOwnershipService.assertPaymentInRestaurant(paymentId, req.user!.restaurantId);
  const result = await OrderService.markTicketPaid(paymentId, ticket_part);
  res.json(result);
});

export const deleteItem = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await OrderOwnershipService.assertItemInRestaurant(String(req.params.id), req.user!.restaurantId);
  await OrderService.deleteItem(String(req.params.id), req.user!.permissions);
  res.status(204).end();
});

export const assignItemToCustomer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { customer_id } = req.body;
  await OrderOwnershipService.assertItemInRestaurant(String(req.params.id), req.user!.restaurantId);
  const item = await OrderService.assignItemToCustomer(String(req.params.id), customer_id);
  res.json(item);
});

export const getServiceItems = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const items = await OrderService.getServiceItems(req.user!.restaurantId);
  res.json(items);
});
