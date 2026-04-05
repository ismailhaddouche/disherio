import { Request, Response } from 'express';
import { asyncHandler, createError } from '../utils/async-handler';
import * as TotemService from '../services/totem.service';
import * as DishService from '../services/dish.service';
import * as OrderService from '../services/order.service';
import * as MenuLanguageService from '../services/menu-language.service';
import { ItemOrder, IOrder } from '../models/order.model';
import { ILocalizedEntry } from '../models/dish.model';

/**
 * Helper to normalize localized fields to array format
 * Handles legacy object format { es: 'value', en: 'value' } -> [{ lang: 'es', value: 'value' }, ...]
 * and ensures array format is valid
 */
function normalizeLocalizedField(field: unknown): ILocalizedEntry[] {
  // If it's already an array, validate and return
  if (Array.isArray(field)) {
    return field.filter(item => item && typeof item === 'object' && item.lang);
  }
  
  // If it's an object (legacy format), convert to array
  if (field && typeof field === 'object' && !Array.isArray(field)) {
    return Object.entries(field).map(([lang, value]) => ({
      lang,
      value: String(value || '')
    }));
  }
  
  // Return empty array as fallback
  return [];
}

export const listTotems = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const totems = await TotemService.getTotemsByRestaurant(req.user!.restaurantId);
  res.json(totems);
});

export const getTotem = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const totem = await TotemService.getTotemById(String(req.params.id));
  if (!totem) {
    throw createError.notFound('TOTEM_NOT_FOUND');
  }
  // Verify totem belongs to user's restaurant
  if (totem.restaurant_id.toString() !== req.user!.restaurantId) {
    throw createError.forbidden('FORBIDDEN');
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
    throw createError.notFound('TOTEM_NOT_FOUND');
  }
  res.json(totem);
});

// BUG-04: public endpoint so the QR-facing totem page can load the menu without a JWT
export const getMenuDishes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const totem = await TotemService.getTotemByQR(String(req.params.qr));
  if (!totem) {
    throw createError.notFound('TOTEM_NOT_FOUND');
  }
  const restaurantId = totem.restaurant_id.toString();
  const [categories, dishes, menuLanguages] = await Promise.all([
    DishService.getCategoriesByRestaurant(restaurantId),
    DishService.getDishesByRestaurant(restaurantId),
    MenuLanguageService.getByRestaurant(restaurantId),
  ]);
  res.json({ categories, dishes, menuLanguages });
});

export const getActiveSessions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const sessions = await TotemService.getActiveSessionsByRestaurant(req.user!.restaurantId);
  res.json(sessions);
});

// Public: get or create session for a totem via QR
export const getOrCreateSessionByQR = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { session, totem } = await TotemService.getOrCreateSessionByQR(String(req.params.qr));
  res.json({
    session_id: session._id,
    totem_id: totem._id,
    totem_name: totem.totem_name,
    restaurant_id: totem.restaurant_id,
    totem_state: session.totem_state,
  });
});

// Public: create order + items from totem QR page (no auth needed)
export const createPublicOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { session } = await TotemService.getOrCreateSessionByQR(String(req.params.qr));

  if (session.totem_state !== 'STARTED') {
    throw createError.badRequest('SESSION_NOT_ACTIVE');
  }

  const { items, customer_id } = req.body as { items: Array<{ dishId: string; quantity: number; variantId?: string; extras?: string[] }>; customer_id?: string };
  if (!items || !items.length) {
    throw createError.badRequest('NO_ITEMS');
  }

  const order = await OrderService.createOrder(session._id.toString()) as IOrder;

  // BATCH OPERATIONS: Preparar items para batch insert
  // Obtener todos los dishes únicos para enriquecer los datos
  const uniqueDishIds = [...new Set(items.map(item => item.dishId))];
  const dishes = await Promise.all(uniqueDishIds.map(id => DishService.getDishById(id)));
  const dishMap = new Map(dishes.filter(d => d !== null).map(d => [d!._id.toString(), d!]));

  // Preparar items para batch insert
  const itemsToCreate = [];
  for (const item of items) {
    const dish = dishMap.get(item.dishId);
    if (!dish) {
      throw createError.badRequest('DISH_NOT_FOUND');
    }
    if (dish.disher_status !== 'ACTIVATED') {
      throw createError.badRequest('DISH_NOT_AVAILABLE');
    }

    // Buscar variant y extras seleccionados
    const variant = item.variantId
      ? dish.variants.find((v: { _id: { toString(): string } }) => v._id.toString() === item.variantId)
      : null;
    const selectedExtras = dish.extras.filter((e: { _id: { toString(): string } }) =>
      (item.extras ?? []).includes(e._id.toString())
    );

    const quantity = item.quantity || 1;
    
    // Normalize dish name to array format
    const normalizedDishName = normalizeLocalizedField(dish.disher_name);
    if (normalizedDishName.length === 0) {
      throw createError.badRequest('DISH_NAME_INVALID');
    }
    
    // Validate dish price
    if (typeof dish.disher_price !== 'number' || dish.disher_price < 0) {
      throw createError.badRequest('DISH_PRICE_INVALID');
    }
    
    for (let i = 0; i < quantity; i++) {
      // Normalize variant data
      const normalizedVariant = variant
        ? {
            variant_id: variant._id.toString(),
            name: normalizeLocalizedField(variant.variant_name),
            price: variant.variant_price,
          }
        : null;
      
      // Validate variant if exists
      if (normalizedVariant && normalizedVariant.name.length === 0) {
        throw createError.badRequest('VARIANT_NAME_INVALID');
      }
      
      // Normalize extras data
      const normalizedExtras = selectedExtras.map((e: { _id: { toString(): string }; extra_name: unknown; extra_price: number }) => ({
        extra_id: e._id.toString(),
        name: normalizeLocalizedField(e.extra_name),
        price: e.extra_price,
      }));
      
      // Validate extras names
      for (const extra of normalizedExtras) {
        if (extra.name.length === 0) {
          throw createError.badRequest('EXTRA_NAME_INVALID');
        }
      }
      
      itemsToCreate.push({
        order_id: order._id,
        session_id: session._id,
        item_dish_id: item.dishId,
        customer_id: customer_id,
        item_state: 'ORDERED',
        item_disher_type: dish.disher_type,
        item_name_snapshot: normalizedDishName,
        item_base_price: dish.disher_price,
        item_disher_variant: normalizedVariant,
        item_disher_extras: normalizedExtras,
      });
    }
  }

  // BATCH INSERT: Crear todos los items en una sola operación
  let createdItems;
  try {
    createdItems = await ItemOrder.insertMany(itemsToCreate, { ordered: false });
  } catch (insertError: any) {
    // Log detailed error for debugging
    console.error('[createPublicOrder] InsertMany error:', insertError);
    if (insertError.name === 'ValidationError') {
      const validationErrors = Object.entries(insertError.errors || {}).map(([field, err]: [string, any]) => ({
        field,
        message: err.message,
      }));
      console.error('[createPublicOrder] Validation errors:', validationErrors);
      throw createError.badRequest('VALIDATION_ERROR', { details: validationErrors });
    }
    throw createError.badRequest('ORDER_CREATION_FAILED');
  }

  // Emitir eventos de socket para items de cocina
  for (const item of createdItems) {
    if (item.item_disher_type === 'KITCHEN') {
      // Emitir evento para KDS
      const io = (await import('../config/socket')).getIO();
      io.to(`session:${session._id}`).emit('kds:new_item', item);
    }
  }

  // Notificar a TAS (camareros) sobre el nuevo pedido
  const { notifyTASNewOrder } = await import('../sockets/tas.handler');
  notifyTASNewOrder(session._id.toString(), {
    items: createdItems,
    orderId: order._id.toString(),
    addedBy: 'customer',
  });

  res.status(201).json({ order_id: order._id, items: createdItems });
});

// Public: create a customer for a session
export const createCustomer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.params;
  const { customer_name } = req.body;

  if (!customer_name || typeof customer_name !== 'string' || customer_name.trim().length < 2) {
    throw createError.badRequest('CUSTOMER_NAME_REQUIRED');
  }

  const customer = await TotemService.createCustomer(String(sessionId), customer_name.trim());
  res.status(201).json({
    customer_id: customer._id,
    customer_name: customer.customer_name,
    session_id: customer.session_id,
  });
});

// Public: get customers for a session
export const getSessionCustomers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.params;
  const customers = await TotemService.getCustomersBySession(String(sessionId));
  res.json(customers.map(c => ({
    customer_id: c._id,
    customer_name: c.customer_name,
  })));
});

// Public: get all items for a session (all orders)
export const getSessionOrders = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.params;
  const items = await TotemService.getSessionItems(String(sessionId));
  res.json(items);
});

// Public: get items for a specific customer (my orders)
export const getCustomerOrders = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { customerId } = req.params;
  const items = await TotemService.getCustomerItems(String(customerId));
  res.json(items);
});
