import { Request, Response } from 'express';
import i18next from 'i18next';
import { ErrorCode } from '@disherio/shared';
import { asyncHandler, createError } from '../utils/async-handler';
import * as TotemService from '../services/totem.service';
import { assertCanMutateTotem } from '../services/totem.service';
import * as DishService from '../services/dish.service';
import * as OrderService from '../services/order.service';
import * as OrderOwnershipService from '../services/order-ownership.service';
import * as OrderRequestPolicy from '../services/order-request-policy.service';
import * as PublicOrderService from '../services/public-order.service';
import * as SessionLifecycleEffects from '../services/session-lifecycle-effects.service';
import { cancelPendingSessionClose } from '../sockets/totem.handler';

type SessionLike = {
  _id: { toString(): string };
  toObject?: () => Record<string, unknown>;
};

function sessionToResponse(session: SessionLike): Record<string, unknown> {
  // The ephemeral session_token is a public-flow credential issued only by the
  // QR endpoints; staff-facing session responses must not expose it.
  const { session_token: _sessionToken, ...rest } = session.toObject ? session.toObject() : { ...session };
  return rest;
}

export const listTotems = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const totems = await TotemService.getTotemsByRestaurant(req.user!.restaurantId);
  res.json(totems);
});

export const getTotem = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const totem = await TotemService.getTotemForRestaurant(String(req.params.id), req.user!.restaurantId);
  res.json({
    _id: totem._id,
    totem_name: totem.totem_name,
    totem_type: totem.totem_type,
  });
});

export const createTotem = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // Enforce the totem-type policy: TAS may only create TEMPORARY totems.
  assertCanMutateTotem(req.body.totem_type, req.user!.permissions);
  const totem = await TotemService.createTotem({ ...req.body, restaurant_id: req.user!.restaurantId });
  res.status(201).json(totem);
});

export const updateTotem = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const totem = await TotemService.getTotemForRestaurant(String(req.params.id), req.user!.restaurantId);
  // Restrict by the totem's existing type; TAS may only update TEMPORARY totems.
  assertCanMutateTotem(totem.totem_type, req.user!.permissions);
  const updated = await TotemService.updateTotem(String(req.params.id), req.body);
  res.json(updated);
});

export const deleteTotem = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const totem = await TotemService.getTotemForRestaurant(String(req.params.id), req.user!.restaurantId);
  assertCanMutateTotem(totem.totem_type, req.user!.permissions);
  await TotemService.deleteTotem(String(req.params.id));
  res.status(204).end();
});

export const regenerateQr = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const totem = await TotemService.getTotemForRestaurant(String(req.params.id), req.user!.restaurantId);
  assertCanMutateTotem(totem.totem_type, req.user!.permissions);
  const qr = await TotemService.regenerateQr(String(req.params.id));
  res.json({ qr });
});

export const startSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await TotemService.getTotemForRestaurant(String(req.params.totemId), req.user!.restaurantId);
  const session = await TotemService.startSession(String(req.params.totemId)) as SessionLike;
  const orderLimitStatus = await OrderRequestPolicy.getSessionOrderLimitStatus(
    session._id.toString(),
    req.user!.restaurantId
  );
  res.status(201).json({ ...sessionToResponse(session), order_limit_status: orderLimitStatus });
});

export const getMenuByQR = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const totem = await TotemService.getTotemByQR(String(req.params.qr));
  if (!totem) {
    throw createError.notFound('TOTEM_NOT_FOUND');
  }
  res.json(totem);
});

// Public endpoint: the QR-facing totem page loads the menu without a staff JWT.
// Access is rate-limited by the public QR limiter on the route.
export const getMenuDishes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const totem = await TotemService.getTotemByQR(String(req.params.qr));
  if (!totem) {
    throw createError.notFound('TOTEM_NOT_FOUND');
  }
  const restaurantId = totem.restaurant_id.toString();
  const [categories, dishes] = await Promise.all([
    DishService.getCategoriesByRestaurant(restaurantId),
    DishService.getDishesByRestaurant(restaurantId),
  ]);
  res.json({ categories, dishes });
});

export const getActiveSessions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const sessions = await TotemService.getActiveSessionsByRestaurant(req.user!.restaurantId) as SessionLike[];
  const sessionIds = sessions.map(session => session._id.toString());
  const [orderLimitStatuses, itemCounts] = await Promise.all([
    OrderRequestPolicy.getSessionOrderLimitStatuses(sessionIds, req.user!.restaurantId),
    OrderRequestPolicy.getActiveItemCountsBySessionIds(sessionIds),
  ]);
  const enriched = sessions.map(session => ({
    ...sessionToResponse(session),
    order_limit_status: orderLimitStatuses.get(session._id.toString()),
    item_count: itemCounts.get(session._id.toString()) ?? 0,
  }));
  res.json(enriched);
});

export const closeSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const sessionId = String(req.params.sessionId);
  await OrderOwnershipService.assertSessionInRestaurant(sessionId, req.user!.restaurantId);
  const session = await TotemService.closeSession(sessionId);
  if (!session) {
    // The session was not in STARTED state (already closed by another path).
    throw createError.conflict('SESSION_NOT_ACTIVE');
  }
  await SessionLifecycleEffects.notifySessionClosed(sessionId, {
    restaurantId: req.user!.restaurantId,
    state: 'COMPLETE',
    closedByName: req.user?.name,
    reason: i18next.t('sockets.SESSION_CLOSED_BY_STAFF'),
  });
  res.json(sessionToResponse(session as SessionLike));
});

export const reopenSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const sessionId = String(req.params.sessionId);
  await OrderOwnershipService.assertSessionInRestaurant(sessionId, req.user!.restaurantId);
  const session = await TotemService.reopenSession(sessionId) as SessionLike | null;
  if (!session) {
    throw createError.notFound('SESSION_NOT_FOUND');
  }
  // Drop the force-disconnect scheduled when the session was closed so
  // customers who rejoin the reopened session are not kicked out.
  cancelPendingSessionClose(sessionId);
  const orderLimitStatus = await OrderRequestPolicy.getSessionOrderLimitStatus(sessionId, req.user!.restaurantId);
  SessionLifecycleEffects.notifySessionReopened(sessionId, req.user!.restaurantId, req.user?.name);
  res.json({ ...sessionToResponse(session), order_limit_status: orderLimitStatus });
});

export const archiveSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const sessionId = String(req.params.sessionId);
  await OrderOwnershipService.assertSessionInRestaurant(sessionId, req.user!.restaurantId);
  const session = await OrderService.archiveSession(sessionId);
  res.json(sessionToResponse(session as SessionLike));
});

export const cancelSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const sessionId = String(req.params.sessionId);
  await OrderOwnershipService.assertSessionInRestaurant(sessionId, req.user!.restaurantId);
  const session = await TotemService.cancelSession(sessionId);
  if (!session) {
    throw createError.conflict('SESSION_NOT_ACTIVE');
  }
  await SessionLifecycleEffects.notifySessionClosed(sessionId, {
    restaurantId: req.user!.restaurantId,
    state: 'CANCELLED',
    closedByName: req.user?.name,
    reason: i18next.t('sockets.SESSION_CANCELLED'),
  });
  await SessionLifecycleEffects.cleanupTemporaryTotem(session);
  res.json(sessionToResponse(session as SessionLike));
});

export const getTotemSessions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await TotemService.getTotemForRestaurant(String(req.params.totemId), req.user!.restaurantId);
  const sessions = await TotemService.getTotemSessions(String(req.params.totemId));
  res.json(sessions.map((session) => sessionToResponse(session as SessionLike)));
});

// Public: get or create session for a totem via QR
export const getOrCreateSessionByQR = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { session, totem } = await TotemService.getOrCreateSessionByQR(String(req.params.qr));
  const orderLimitStatus = await OrderRequestPolicy.getSessionOrderLimitStatus(
    session._id.toString(),
    totem.restaurant_id.toString()
  );
  res.json({
    session_id: session._id,
    totem_id: totem._id,
    totem_name: totem.totem_name,
    restaurant_id: totem.restaurant_id,
    totem_state: session.totem_state,
    session_token: session.session_token,
    order_limit_status: orderLimitStatus,
  });
});

// Public: create order + items from totem QR page (no auth needed)
export const createPublicOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { request_id, session_id, items, customer_id, session_token } = req.body as {
    request_id: string;
    session_id: string;
    items: Array<{ dishId: string; quantity: number; variantId?: string; extras?: string[] }>;
    customer_id?: string;
    session_token?: string;
  };

  const result = await PublicOrderService.createPublicOrderFromQR(
    String(req.params.qr),
    session_id,
    items,
    request_id,
    customer_id,
    session_token
  );

  res.status(201).json({ order_id: result.orderId, items: result.items });
});

// Public: create a customer for a session
export const createCustomer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { qr, sessionId } = req.params;
  const { customer_name, session_token } = req.body as { customer_name: string; session_token?: string };

  if (!customer_name || typeof customer_name !== 'string' || customer_name.trim().length < 2) {
    throw createError.badRequest(ErrorCode.CUSTOMER_NAME_REQUIRED);
  }

  const customer = await TotemService.createCustomer(
    String(qr),
    String(sessionId),
    customer_name.trim(),
    session_token
  );
  res.status(201).json({
    customer_id: customer._id,
    customer_name: customer.customer_name,
    session_id: customer.session_id,
  });
});

// Public: get customers for a session
export const getSessionCustomers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { qr, sessionId } = req.params;
  const sessionToken = req.get('x-session-token');
  const customers = await TotemService.getCustomersBySession(String(qr), String(sessionId), sessionToken);
  res.json(customers.map(c => ({
    customer_id: c._id,
    customer_name: c.customer_name,
  })));
});

// Public: get all items for a session (all orders)
export const getSessionOrders = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { qr, sessionId } = req.params;
  const sessionToken = req.get('x-session-token');
  const items = await TotemService.getSessionItems(String(qr), String(sessionId), sessionToken);
  res.json(items);
});

// Public: get items for a specific customer (my orders)
export const getCustomerOrders = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { qr, sessionId, customerId } = req.params;
  const sessionToken = req.get('x-session-token');
  const items = await TotemService.getCustomerItems(
    String(qr),
    String(sessionId),
    String(customerId),
    sessionToken
  );
  res.json(items);
});
