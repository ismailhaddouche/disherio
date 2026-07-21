import { Server } from 'socket.io';
import i18next from 'i18next';
import type {
  ItemCancelPayload,
  ItemIdPayload,
  TASAddItemData,
  TASCallWaiterResponsePayload,
  TASCustomerBillRequestEvent,
  TASHelpRequest,
  TASNotifyCustomersPayload,
  TASRequestBillPayload,
} from '@disherio/shared';
import { ItemOrder, IItemOrder } from '../models/order.model';
import { TotemSession } from '../models/totem.model';
import { logger } from '../config/logger';
import { AuthenticatedSocket } from '../middlewares/socketAuth';
import { getIO } from '../config/socket';
import { notifyCustomerFromWaiter, closeSessionForCustomers } from './totem.handler';
import { notifyKDSItemCanceled } from './kds.handler';
import { addItemToOrder, updateItemState } from '../services/order.service';
import { trackSocketConnection, cleanupSocketConnection, trackSocketJoinRoom, trackSocketLeaveRoom, updateSocketActivity } from './middleware/connection-tracker';
import { rateLimitMiddleware } from './middleware/rate-limiter';
import { validateSessionAccess } from './middleware/session-validator';
import { sanitizeSocketError } from './middleware/validate-payload';

/**
 * TAS (Table Assistance Service) Socket Handler
 *
 * Handles real-time communication for waiters/table assistance:
 * - Receives: Events from customers (new orders, help requests) and kitchen (item state changes)
 * - Emits: New items added, service items served, bill requests, session updates
 */

// Track active TAS subscriptions per session
const tasSessionSubscriptions = new Map<string, Set<string>>(); // sessionId -> Set of socketIds

// Track socket subscriptions for quick cleanup on disconnect
const socketSubscriptions = new Map<string, Set<string>>(); // socketId -> Set of sessionIds

// Track last activity for TTL cleanup
const tasLastActivity = new Map<string, number>(); // socketId -> timestamp

// Configuration for cleanup
const TAS_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Run cleanup every hour

// Cleanup stale TAS entries
function cleanupStaleTASEntries(): void {
  const now = Date.now();
  let cleanedSockets = 0;
  let cleanedSessions = 0;

  // Clean up stale socket subscriptions
  for (const [socketId, lastActivity] of tasLastActivity.entries()) {
    if (now - lastActivity > TAS_TIMEOUT_MS) {
      // Remove from all session subscriptions
      const sessions = socketSubscriptions.get(socketId);
      if (sessions) {
        sessions.forEach(sessionId => {
          const subs = tasSessionSubscriptions.get(sessionId);
          if (subs) {
            subs.delete(socketId);
            if (subs.size === 0) {
              tasSessionSubscriptions.delete(sessionId);
              cleanedSessions++;
            }
          }
        });
        socketSubscriptions.delete(socketId);
      }
      tasLastActivity.delete(socketId);
      cleanedSockets++;
    }
  }

  if (cleanedSockets > 0 || cleanedSessions > 0) {
    logger.info(
      { cleanedSockets, cleanedSessions },
      'Cleaned up stale TAS tracking entries'
    );
  }
}

// Start periodic cleanup
const cleanupInterval = setInterval(cleanupStaleTASEntries, CLEANUP_INTERVAL_MS);
cleanupInterval.unref();

// Ensure cleanup interval is cleared on process exit (for tests)
process.once('exit', () => clearInterval(cleanupInterval));

/**
 * Validate that the socket has joined the session and belongs to the
 * authenticated user's restaurant. Prevents cross-tenant operations.
 * Returns true if access is allowed, false otherwise (emits a tas:error on rejection).
 */
async function assertTasSessionAccess(
  socket: AuthenticatedSocket,
  sessionId: string
): Promise<boolean> {
  const validation = await validateSessionAccess(socket, sessionId);
  if (!validation.allowed) {
    socket.emit('tas:error', { message: validation.reason || 'UNAUTHORIZED' });
    return false;
  }
  const subs = tasSessionSubscriptions.get(sessionId);
  if (!subs || !subs.has(socket.id)) {
    socket.emit('tas:error', { message: 'UNAUTHORIZED', details: 'Must join session before operating' });
    return false;
  }
  return true;
}

export function registerTasHandlers(io: Server, socket: AuthenticatedSocket): void {
  const user = socket.user;

  // Verify user has TAS permission
  if (!user || !user.permissions.includes('TAS')) {
    logger.warn({ socketId: socket.id }, 'Unauthorized TAS connection attempt');
    return;
  }

  const staffId = user.staffId;

  // Track this connection
  trackSocketConnection(socket, 'TAS', { userId: staffId });
  const restaurantRoom = `tas:restaurant:${user.restaurantId}`;
  socket.join(restaurantRoom);
  trackSocketJoinRoom(socket.id, restaurantRoom);

  // Initialize socket subscription tracking
  socketSubscriptions.set(socket.id, new Set());
  tasLastActivity.set(socket.id, Date.now());

  logger.info({ socketId: socket.id, staffId }, 'TAS client connected');

  // ==================== SESSION MANAGEMENT ====================

  /**
   * Join TAS session room and subscribe to all events for this session
   * Payload: { sessionId: string }
   */
  socket.on('tas:join', rateLimitMiddleware(socket, 'tas:join', async (sessionId: string) => {
    if (!sessionId || typeof sessionId !== 'string') {
      socket.emit('tas:error', { message: 'INVALID_SESSION_ID' });
      return;
    }

    // Validate session access
    const validation = await validateSessionAccess(socket, sessionId);
    if (!validation.allowed) {
      socket.emit('tas:error', {
        message: validation.reason || 'UNAUTHORIZED'
      });
      return;
    }

    const roomName = `tas:session:${sessionId}`;
    socket.join(roomName);
    socket.join(`session:${sessionId}`);

    // Track subscription
    if (!tasSessionSubscriptions.has(sessionId)) {
      tasSessionSubscriptions.set(sessionId, new Set());
    }
    tasSessionSubscriptions.get(sessionId)!.add(socket.id);

    // Track socket's subscriptions for cleanup
    const socketSubs = socketSubscriptions.get(socket.id);
    if (socketSubs) {
      socketSubs.add(sessionId);
    }

    // Update activity
    tasLastActivity.set(socket.id, Date.now());

    // Track room joins in connection tracker
    trackSocketJoinRoom(socket.id, roomName);
    trackSocketJoinRoom(socket.id, `session:${sessionId}`);

    // Update activity
    updateSocketActivity(socket.id);

    logger.info({ socketId: socket.id, staffId, sessionId }, 'TAS joined session');
    socket.emit('tas:joined', { sessionId, timestamp: new Date().toISOString() });
  }));

  /**
   * Leave TAS session room
   * Payload: { sessionId: string }
   */
  socket.on('tas:leave', rateLimitMiddleware(socket, 'tas:leave', (sessionId: string) => {
    if (!sessionId || typeof sessionId !== 'string') {
      socket.emit('tas:error', { message: 'INVALID_SESSION_ID' });
      return;
    }

    const roomName = `tas:session:${sessionId}`;
    socket.leave(roomName);
    socket.leave(`session:${sessionId}`);

    // Remove from tracking
    const subs = tasSessionSubscriptions.get(sessionId);
    if (subs) {
      subs.delete(socket.id);
      if (subs.size === 0) {
        tasSessionSubscriptions.delete(sessionId);
      }
    }

    // Remove from socket's subscription tracking
    const socketSubs = socketSubscriptions.get(socket.id);
    if (socketSubs) {
      socketSubs.delete(sessionId);
    }

    // Update activity
    tasLastActivity.set(socket.id, Date.now());

    // Track room leaves in connection tracker
    trackSocketLeaveRoom(socket.id, roomName);
    trackSocketLeaveRoom(socket.id, `session:${sessionId}`);

    // Update activity
    updateSocketActivity(socket.id);

    logger.info({ socketId: socket.id, staffId, sessionId }, 'TAS left session');
    socket.emit('tas:left', { sessionId });
  }));

  // ==================== ITEMS MANAGEMENT ====================

  /**
   * TAS adds new item to an order
   * This emits to: kitchen (if kitchen item), session customers, and other TAS in session
   * Payload: {
   *   sessionId: string,
   *   orderId: string,
   *   dishId: string,
   *   customerId?: string,
   *   variantId?: string,
   *   extras?: string[]
   * }
   */
  socket.on('tas:add_item', rateLimitMiddleware(socket, 'tas:add_item', async (data: TASAddItemData) => {
    try {
      const { sessionId, orderId, dishId, customerId, variantId, extras } = data;

      if (!sessionId || !orderId || !dishId) {
        socket.emit('tas:error', { message: 'INVALID_DATA', details: 'Missing required fields: sessionId, orderId, dishId' });
        return;
      }

      // Validate session ownership and subscription before operating
      if (!(await assertTasSessionAccess(socket, sessionId))) {
        return;
      }

      // Update activity
      tasLastActivity.set(socket.id, Date.now());

      // Persist the item via order service (enforces validation, pricing, state)
      const newItem = await addItemToOrder(
        orderId,
        sessionId,
        dishId,
        customerId,
        variantId,
        extras ?? [],
        'TAS',
        staffId
      );

      // Broadcasts are handled inside addItemToOrder (KDS, TAS, POS via service)
      // Emit confirmation and customer-facing event
      emitToCustomers(sessionId, 'order:items_added', {
        items: [newItem],
        addedBy: 'waiter',
        timestamp: new Date().toISOString(),
      });

      io.to(`session:${sessionId}`).emit('item:added', {
        item: newItem,
        addedBy: 'TAS',
        staffId,
        timestamp: new Date().toISOString(),
      });

      socket.emit('tas:item_added_confirm', {
        success: true,
        sessionId,
        item: newItem,
        timestamp: new Date().toISOString(),
      });

      logger.info({ sessionId, staffId, dishId, itemType: newItem.item_disher_type }, 'TAS added item');
    } catch (err: unknown) {
      logger.error({ err, staffId }, 'tas:add_item error');
      socket.emit('tas:error', { message: sanitizeSocketError(err) });
    }
  }));

  /**
   * Mark a SERVICE item (drinks, etc.) as served
   * Kitchen items are handled by KDS handler
   * Payload: { itemId: string }
   */
  socket.on('tas:serve_service_item', rateLimitMiddleware(socket, 'tas:serve_service_item', async (payload: ItemIdPayload) => {
    // Optional chaining: payload may be null/undefined from a malformed client event
    const itemId = payload?.itemId;
    try {
      if (!itemId || typeof itemId !== 'string') {
        socket.emit('tas:error', { message: 'INVALID_ITEM_ID' });
        return;
      }

      // Update activity
      tasLastActivity.set(socket.id, Date.now());

      const existingItem = await ItemOrder.findById(itemId).select('session_id item_disher_type').lean();

      if (!existingItem || existingItem.item_disher_type !== 'SERVICE') {
        socket.emit('tas:error', {
          message: 'ITEM_NOT_FOUND_OR_INVALID_STATE',
          details: 'Item may not exist, is not a SERVICE item, or is not in ORDERED state',
        });
        return;
      }

      // Validate session ownership and subscription before operating
      const itemSessionId = existingItem.session_id.toString();
      if (!(await assertTasSessionAccess(socket, itemSessionId))) {
        return;
      }

      const item = await updateItemState(itemId, 'SERVED', staffId, user.permissions ?? [], 'TAS') as IItemOrder | null;

      if (!item) {
        socket.emit('tas:error', {
          message: 'ITEM_NOT_FOUND_OR_INVALID_STATE',
          details: 'Item may not exist, is not a SERVICE item, or is not in ORDERED state'
        });
        return;
      }

      const sessionId = item.session_id.toString();

      // Broadcast to all TAS in session
      io.to(`tas:session:${sessionId}`).emit('tas:service_item_served', {
        itemId: item._id,
        sessionId,
        servedBy: staffId,
        timestamp: new Date().toISOString(),
      });

      // Notify customers
      emitToCustomers(sessionId, 'item:served', {
        itemId: item._id,
        itemName: item.item_name_snapshot,
      });

      socket.emit('tas:item_served_confirm', {
        success: true,
        itemId,
        newState: 'SERVED'
      });

      logger.info({ itemId, staffId, sessionId }, 'TAS served SERVICE item');
    } catch (err: unknown) {
      logger.error({ err, itemId, staffId }, 'tas:serve_service_item error');
      socket.emit('tas:error', { message: 'INTERNAL_ERROR' });
    }
  }));

  /**
   * Cancel an item (waiter cancels an item from the order)
   * Payload: { itemId: string, reason?: string }
   */
  socket.on('tas:cancel_item', rateLimitMiddleware(socket, 'tas:cancel_item', async (payload: ItemCancelPayload) => {
    // Optional chaining: payload may be null/undefined from a malformed client event
    const itemId = payload?.itemId;
    const reason = payload?.reason;
    try {
      if (!itemId || typeof itemId !== 'string') {
        socket.emit('tas:error', { message: 'INVALID_ITEM_ID' });
        return;
      }

      // Update activity
      tasLastActivity.set(socket.id, Date.now());

      // Validate session ownership before cancelling.
      // Look up the item's session to enforce tenant boundary.
      const existingItem = await ItemOrder.findById(itemId).select('session_id').lean();
      if (!existingItem) {
        socket.emit('tas:error', { message: 'ITEM_NOT_FOUND_OR_INVALID_STATE' });
        return;
      }
      if (!(await assertTasSessionAccess(socket, existingItem.session_id.toString()))) {
        return;
      }

      // Use service layer to enforce state machine + permission rules
      // (ON_PREPARE items require ADMIN or POS authorization)
      let item: IItemOrder | null;
      try {
        item = (await updateItemState(itemId, 'CANCELED', staffId, user.permissions ?? [], 'TAS')) as IItemOrder | null;
      } catch (serviceErr: unknown) {
        const msg = serviceErr instanceof Error && serviceErr.message ? serviceErr.message : 'CANCEL_FAILED';
        socket.emit('tas:error', { message: msg });
        return;
      }

      if (!item) {
        socket.emit('tas:error', {
          message: 'ITEM_NOT_FOUND_OR_INVALID_STATE',
          details: 'Item may not exist or is already served/canceled'
        });
        return;
      }

      const sessionId = item.session_id?.toString();

      // Notify TAS in session
      io.to(`tas:session:${sessionId}`).emit('tas:item_canceled', {
        itemId: item._id,
        sessionId,
        canceledBy: staffId,
        reason: reason || 'No reason provided',
        timestamp: new Date().toISOString(),
      });

      // Notify customers
      emitToCustomers(sessionId, 'item:canceled', {
        itemId: item._id,
        itemName: item.item_name_snapshot,
        reason,
      });

      // 4. Notify kitchen if it was a kitchen item
      if (item.item_disher_type === 'KITCHEN') {
        notifyKDSItemCanceled(sessionId, {
          itemId: item._id,
          itemName: item.item_name_snapshot,
          canceledBy: staffId,
          canceledByName: user.name,
          reason: reason || 'No reason provided',
        });
      }

      // 5. Notify POS about cancellation
      io.to(`pos:session:${sessionId}`).emit('pos:item_canceled', {
        itemId: item._id,
        itemName: item.item_name_snapshot,
        itemType: item.item_disher_type,
        canceledBy: staffId,
        canceledByName: user.name,
        reason: reason || 'No reason provided',
        timestamp: new Date().toISOString(),
      });

      // 6. Emit generic item:canceled for compatibility
      io.to(`session:${sessionId}`).emit('item:canceled', {
        itemId: item._id,
        newState: 'CANCELED',
        canceledBy: 'TAS',
        staffId,
        timestamp: new Date().toISOString(),
      });

      socket.emit('tas:item_canceled_confirm', { success: true, itemId });
      logger.info({ itemId, staffId, sessionId, reason }, 'TAS canceled item');
    } catch (err: unknown) {
      logger.error({ err, itemId, staffId }, 'tas:cancel_item error');
      socket.emit('tas:error', { message: 'INTERNAL_ERROR' });
    }
  }));

  // ==================== BILL & PAYMENT ====================

  /**
   * Request bill/check for a session
   * Payload: { sessionId: string, requestedBy: 'waiter' | 'customer', customerId?: string }
   */
  socket.on('tas:request_bill', rateLimitMiddleware(socket, 'tas:request_bill', async (data: TASRequestBillPayload) => {
    try {
      const { sessionId, requestedBy, customerId, splitType } = data;

      if (!sessionId) {
        socket.emit('tas:error', { message: 'INVALID_SESSION_ID' });
        return;
      }

      // Validate session ownership and subscription before operating
      if (!(await assertTasSessionAccess(socket, sessionId))) {
        return;
      }

      // Update activity
      tasLastActivity.set(socket.id, Date.now());

      // Validate session is in STARTED state before requesting bill
      const session = await TotemSession.findById(sessionId).select('totem_state').lean();
      if (!session) {
        socket.emit('tas:error', { message: 'SESSION_NOT_FOUND' });
        return;
      }
      if (session.totem_state !== 'STARTED') {
        socket.emit('tas:error', { message: 'SESSION_NOT_ACTIVE', details: `Session state is ${session.totem_state}` });
        return;
      }

      const persisted = await closeSessionForCustomers(sessionId, {
        closedBy: requestedBy === 'waiter' ? 'waiter' : 'pos',
        closedByName: user.name,
        reason: i18next.t(requestedBy === 'waiter' ? 'sockets.BILL_REQUESTED_BY_WAITER' : 'sockets.BILL_REQUESTED_BY_CUSTOMER'),
      });
      if (!persisted) {
        socket.emit('tas:error', { message: 'SESSION_NOT_ACTIVE' });
        return;
      }

      const billRequest = {
        sessionId,
        requestedBy,
        requestedByStaff: requestedBy === 'waiter' ? staffId : undefined,
        customerId,
        splitType: splitType || 'ALL',
        timestamp: new Date().toISOString(),
      };

      // Notify all TAS in session
      io.to(`tas:session:${sessionId}`).emit('tas:bill_requested', billRequest);

      // Notify POS (cashier)
      io.to(`pos:session:${sessionId}`).emit('pos:bill_requested', billRequest);

      // Notify customers
      emitToCustomers(sessionId, 'bill:requested', {
        requestedBy,
        requestedByName: user.name,
        timestamp: billRequest.timestamp,
      });

      socket.emit('tas:bill_request_confirm', { success: true, sessionId });
      logger.info({ sessionId, staffId, requestedBy }, 'Bill requested - session closed for customers');
    } catch (err: unknown) {
      logger.error({ err, staffId }, 'tas:request_bill error');
      socket.emit('tas:error', { message: 'INTERNAL_ERROR' });
    }
  }));

  // Payments and archival use validated REST endpoints; sockets only broadcast
  // the resulting ticket and session lifecycle events.

  // ==================== CUSTOMER SERVICE ====================

  /**
   * Customer calls waiter (this is received from customer client and forwarded to TAS)
   * Note: This event is typically emitted by customer clients, TAS receives it
   */
  socket.on('tas:call_waiter_response', rateLimitMiddleware(socket, 'tas:call_waiter_response', async (data: TASCallWaiterResponsePayload) => {
    try {
      const { sessionId, acknowledged, message } = data;

      if (!sessionId) {
        socket.emit('tas:error', { message: 'INVALID_SESSION_ID' });
        return;
      }

      // Validate session ownership and subscription before operating
      if (!(await assertTasSessionAccess(socket, sessionId))) {
        return;
      }

      // Update activity
      tasLastActivity.set(socket.id, Date.now());

      // Acknowledge the call
      if (acknowledged) {
        emitToCustomers(sessionId, 'waiter:acknowledged', {
          staffId,
          staffName: user.name,
          message: message || i18next.t('sockets.WAITER_COMING_ASSIST'),
          timestamp: new Date().toISOString(),
        });

        socket.emit('tas:call_acknowledged_confirm', { success: true, sessionId });
        logger.info({ sessionId, staffId }, 'Waiter acknowledged customer call');
      }
    } catch (err: unknown) {
      logger.error({ err, staffId }, 'tas:call_waiter_response error');
      socket.emit('tas:error', { message: 'INTERNAL_ERROR' });
    }
  }));

  /**
   * Send message to customers at a table
   * Payload: { sessionId: string, message: string, type?: 'info' | 'warning' | 'success' }
   */
  socket.on('tas:notify_customers', rateLimitMiddleware(socket, 'tas:notify_customers', async (data: TASNotifyCustomersPayload) => {
    try {
      const { sessionId, message, type } = data;

      if (!sessionId || !message) {
        socket.emit('tas:error', { message: 'INVALID_DATA' });
        return;
      }

      // Validate session ownership and subscription before operating
      if (!(await assertTasSessionAccess(socket, sessionId))) {
        return;
      }

      // Update activity
      tasLastActivity.set(socket.id, Date.now());

      notifyCustomerFromWaiter(sessionId, message, user.name, type || 'info');

      socket.emit('tas:notify_confirm', { success: true, sessionId });
      logger.info({ sessionId, staffId }, 'TAS notified customers');
    } catch (err: unknown) {
      logger.error({ err, staffId }, 'tas:notify_customers error');
      socket.emit('tas:error', { message: 'INTERNAL_ERROR' });
    }
  }));

  // ==================== DISCONNECT ====================

  socket.on('disconnect', () => {
    try {
      // Clean up subscriptions using the socket subscription tracking
      const sessions = socketSubscriptions.get(socket.id);
      if (sessions) {
        sessions.forEach(sessionId => {
          const socketIds = tasSessionSubscriptions.get(sessionId);
          if (socketIds) {
            socketIds.delete(socket.id);
            if (socketIds.size === 0) {
              tasSessionSubscriptions.delete(sessionId);
            }
            logger.info({ socketId: socket.id, staffId, sessionId }, 'TAS disconnected, removed from session');
          }
        });
        socketSubscriptions.delete(socket.id);
      }

      // Clean up activity tracking
      tasLastActivity.delete(socket.id);

      // Remove all listeners registered by this socket to prevent memory leaks
      socket.removeAllListeners();

      // Clean up connection tracking
      cleanupSocketConnection(socket.id);

      logger.info({ socketId: socket.id, staffId }, 'TAS client disconnected and cleaned up');
    } catch (err) {
      logger.error({ err, socketId: socket.id, staffId }, 'Error during TAS disconnect cleanup');
    }
  });
}

// ==================== EXPORTED HELPERS ====================

/**
 * Helper function to emit events to TAS from other parts of the system
 * (e.g., when a customer places an order via totem)
 */
export function emitToTAS(sessionId: string, event: string, data: unknown): void {
  try {
    const io = getIO();
    io.to(`tas:session:${sessionId}`).emit(event, data);
    logger.debug({ sessionId, event }, 'Emitted event to TAS');
  } catch (err) {
    logger.error({ err, sessionId, event }, 'Failed to emit event to TAS');
  }
}

/**
 * Notify TAS when a customer places a new order via totem/app.
 * orderData is passed through verbatim; callers send ad-hoc payloads mixing
 * Mongoose item documents and metadata, so no shared contract models it exactly.
 */
export function notifyTASNewOrder(sessionId: string, orderData: object): void {
  emitToTAS(sessionId, 'tas:new_customer_order', {
    ...orderData,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Notify TAS when a customer requests help
 */
export function notifyTASHelpRequest(sessionId: string, customerData: TASHelpRequest): void {
  emitToTAS(sessionId, 'tas:help_requested', {
    ...customerData,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Notify TAS when a customer requests the bill from their device
 */
export function notifyTASBillRequest(sessionId: string, customerData: TASCustomerBillRequestEvent): void {
  emitToTAS(sessionId, 'tas:customer_bill_request', {
    ...customerData,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emit event to customers in a session
 */
function emitToCustomers(sessionId: string, event: string, data: unknown): void {
  try {
    const io = getIO();
    io.to(`customer:session:${sessionId}`).emit(event, data);
    logger.debug({ sessionId, event }, 'Emitted event to customers');
  } catch (err) {
    logger.error({ err, sessionId, event }, 'Failed to emit event to customers');
  }
}

export { tasSessionSubscriptions };
