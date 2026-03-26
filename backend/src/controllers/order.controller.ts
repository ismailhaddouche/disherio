import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler';
import * as OrderService from '../services/order.service';

export const createOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { session_id } = req.body;
  const order = await OrderService.createOrder(session_id, req.user!.staffId);
  res.status(201).json(order);
});

export const addItem = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { order_id, session_id, dish_id, customer_id, variant_id, extras } = req.body;
  const item = await OrderService.addItemToOrder(order_id, session_id, dish_id, customer_id, variant_id, extras);
  res.status(201).json(item);
});

export const updateItemState = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { state } = req.body;
  const item = await OrderService.updateItemState(
    String(req.params.id),
    state,
    req.user!.staffId,
    req.user!.permissions
  );
  res.json(item);
});

export const getKitchenItems = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const items = await OrderService.getKitchenItems(req.user!.restaurantId);
  res.json(items);
});

export const getSessionItems = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const items = await OrderService.getSessionItems(String(req.params.sessionId));
  res.json(items);
});

export const createPayment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { session_id, payment_type, parts, tips } = req.body;
  const payment = await OrderService.createPayment(session_id, payment_type, parts, tips);
  res.status(201).json(payment);
});

export const markTicketPaid = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { ticket_part } = req.body;
  const payment = await OrderService.markTicketPaid(String(req.params.id), ticket_part);
  res.json(payment);
});
