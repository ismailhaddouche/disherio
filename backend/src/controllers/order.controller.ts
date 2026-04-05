import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler, createError } from '../utils/async-handler';
import * as OrderService from '../services/order.service';
import { TotemSession } from '../models/totem.model';
import { Totem } from '../models/totem.model';

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
  const sessionId = String(req.params.sessionId);
  const restaurantId = req.user!.restaurantId;

  const session = await TotemSession.findById(new Types.ObjectId(sessionId))
    .select('totem_id')
    .lean();
  if (!session) {
    throw createError.notFound('SESSION_NOT_FOUND');
  }

  const totem = await Totem.findById(session.totem_id).select('restaurant_id').lean();
  if (!totem || totem.restaurant_id.toString() !== restaurantId) {
    throw createError.forbidden('FORBIDDEN');
  }

  const items = await OrderService.getSessionItems(sessionId);
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

export const deleteItem = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await OrderService.deleteItem(String(req.params.id), req.user!.permissions);
  res.status(204).end();
});

export const assignItemToCustomer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { customer_id } = req.body;
  const item = await OrderService.assignItemToCustomer(String(req.params.id), customer_id);
  res.json(item);
});

export const getServiceItems = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const items = await OrderService.getServiceItems(req.user!.restaurantId);
  res.json(items);
});
