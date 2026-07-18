import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler';
import * as OrderService from '../services/order.service';
import * as OrderOwnershipService from '../services/order-ownership.service';

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
  const { order_id, session_id, dish_id, customer_id, variant_id, extras } = req.body;
  await OrderOwnershipService.assertSessionInRestaurant(session_id, req.user!.restaurantId);
  const item = await OrderService.addItemToOrder(
    order_id,
    session_id,
    dish_id,
    customer_id,
    variant_id,
    extras,
    staffActivitySource(req.user!.permissions),
    req.user!.staffId
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
  const from = typeof req.query.from === 'string' ? new Date(req.query.from) : undefined;
  const to = typeof req.query.to === 'string' ? new Date(req.query.to) : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const parsedLimit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : undefined;

  const payments = await OrderService.getPaymentHistory(req.user!.restaurantId, {
    from: from && !Number.isNaN(from.getTime()) ? from : undefined,
    to: to && !Number.isNaN(to.getTime()) ? to : undefined,
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
