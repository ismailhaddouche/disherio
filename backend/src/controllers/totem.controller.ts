import { Request, Response } from 'express';
import { asyncHandler, createError } from '../utils/async-handler';
import * as TotemService from '../services/totem.service';
import * as DishService from '../services/dish.service';

export const listTotems = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const totems = await TotemService.getTotemsByRestaurant(req.user!.restaurantId);
  res.json(totems);
});

export const getTotem = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const totem = await TotemService.getTotemById(String(req.params.id));
  if (!totem) {
    throw createError.notFound('Tótem no encontrado');
  }
  // Verify totem belongs to user's restaurant
  if (totem.restaurant_id.toString() !== req.user!.restaurantId) {
    throw createError.forbidden('Acceso denegado');
  }
  res.json(totem);
});

export const createTotem = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const totem = await TotemService.createTotem({ ...req.body, restaurant_id: req.user!.restaurantId });
  res.status(201).json(totem);
});

export const updateTotem = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const totem = await TotemService.updateTotem(String(req.params.id), req.body);
  res.json(totem);
});

export const deleteTotem = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await TotemService.deleteTotem(String(req.params.id));
  res.status(204).end();
});

export const regenerateQr = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const qr = await TotemService.regenerateQr(String(req.params.id));
  res.json({ qr });
});

export const startSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const session = await TotemService.startSession(String(req.params.totemId));
  res.status(201).json(session);
});

export const getMenuByQR = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const totem = await TotemService.getTotemByQR(String(req.params.qr));
  if (!totem) {
    throw createError.notFound('Tótem no encontrado');
  }
  res.json(totem);
});

// BUG-04: public endpoint so the QR-facing totem page can load the menu without a JWT
export const getMenuDishes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const totem = await TotemService.getTotemByQR(String(req.params.qr));
  if (!totem) {
    throw createError.notFound('Tótem no encontrado');
  }
  const restaurantId = totem.restaurant_id.toString();
  const [categories, dishes] = await Promise.all([
    DishService.getCategoriesByRestaurant(restaurantId),
    DishService.getDishesByRestaurant(restaurantId),
  ]);
  res.json({ categories, dishes });
});

export const getActiveSessions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const sessions = await TotemService.getActiveSessionsByRestaurant(req.user!.restaurantId);
  res.json(sessions);
});
