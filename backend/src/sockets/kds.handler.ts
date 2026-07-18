import { Server } from 'socket.io';
import { IItemOrder, ItemOrder } from '../models/order.model';
import { logger } from '../config/logger';
import { AuthenticatedSocket } from '../middlewares/socketAuth';
import { getIO } from '../config/socket';
import { trackSocketConnection, cleanupSocketConnection, trackSocketJoinRoom, trackSocketLeaveRoom, updateSocketActivity } from './middleware/connection-tracker';
import { rateLimitMiddleware } from './middleware/rate-limiter';
import { validateSessionAccess } from './middleware/session-validator';
import { updateItemState } from '../services/order.service';

/**
 * KDS (Kitchen Display System) Socket Handler
 *
 * Handles real-time communication for kitchen staff:
 * - Receives: Item preparation events
 * - Emits: Item state changes to TAS and general session
 */

// Track active KDS subscriptions per session
const kdsSessionSubscriptions = new Map<string, Set<string>>(); // sessionId -> Set of socketIds

// Track socket subscriptions for quick cleanup on disconnect
const socketSubscriptions = new Map<string, Set<string>>(); // socketId -> Set of sessionIds

// Track last activity for TTL cleanup
const kdsLastActivity = new Map<string, number>(); // socketId -> timestamp

// Configuration for cleanup
const KDS_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Run cleanup every hour

// Cleanup stale KDS entries
function cleanupStaleKDSEntries(): void {
  const now = Date.now();
  let cleanedSockets = 0;
  let cleanedSessions = 0;

  // Clean up stale socket subscriptions
  for (const [socketId, lastActivity] of kdsLastActivity.entries()) {
    if (now - lastActivity > KDS_TIMEOUT_MS) {
      // Remove from all session subscriptions
      const sessions = socketSubscriptions.get(socketId);
      if (sessions) {
        sessions.forEach(sessionId => {
          const subs = kdsSessionSubscriptions.get(sessionId);
          if (subs) {
            subs.delete(socketId);
            if (subs.size === 0) {
              kdsSessionSubscriptions.delete(sessionId);
              cleanedSessions++;
            }
          }
        });
        socketSubscriptions.delete(socketId);
      }
      kdsLastActivity.delete(socketId);
      cleanedSockets++;
    }
  }

  if (cleanedSockets > 0 || cleanedSessions > 0) {
    logger.info(
      { cleanedSockets, cleanedSessions },
      'Cleaned up stale KDS tracking entries'
    );
  }
}

// Start periodic cleanup
const cleanupInterval = setInterval(cleanupStaleKDSEntries, CLEANUP_INTERVAL_MS);
cleanupInterval.unref();

// Ensure cleanup interval is cleared on process exit (for tests)
process.once('exit', () => clearInterval(cleanupInterval));

export function registerKdsHandlers(_io: Server, socket: AuthenticatedSocket): void {
  // Verify user has kitchen permissions (KTS = Kitchen Table Service)
  const user = socket.user;
  if (!user || !user.permissions.includes('KTS')) {
    logger.warn({ socketId: socket.id }, 'Unauthorized KDS connection attempt');
    return;
  }

  const staffId = user.staffId;
  const restaurantRoom = `kds:restaurant:${user.restaurantId}`;

  // Track this connection
  trackSocketConnection(socket, 'KDS', { userId: staffId });
  socket.join(restaurantRoom);
  trackSocketJoinRoom(socket.id, restaurantRoom);

  // Initialize socket subscription tracking
  socketSubscriptions.set(socket.id, new Set());
  kdsLastActivity.set(socket.id, Date.now());

  logger.info({ socketId: socket.id, staffId }, 'KDS client connected');

  // ==================== SESSION MANAGEMENT ====================

  /**
   * Join KDS session room
   * Payload: { sessionId: string }
   */
  socket.on('kds:join', rateLimitMiddleware(socket, 'kds:join', async (sessionId: string) => {
    if (!sessionId || typeof sessionId !== 'string') {
      socket.emit('kds:error', { message: 'INVALID_SESSION_ID' });
      return;
    }

    // Validate session access
    const validation = await validateSessionAccess(socket, sessionId);
    if (!validation.allowed) {
      socket.emit('kds:error', {
        message: validation.reason || 'UNAUTHORIZED'
      });
      return;
    }

    const roomName = `kitchen:session:${sessionId}`;
    socket.join(roomName);
    socket.join(`session:${sessionId}`);

    // Track subscription
    if (!kdsSessionSubscriptions.has(sessionId)) {
      kdsSessionSubscriptions.set(sessionId, new Set());
    }
    kdsSessionSubscriptions.get(sessionId)!.add(socket.id);

    // Track socket's subscriptions for cleanup
    const socketSubs = socketSubscriptions.get(socket.id);
    if (socketSubs) {
      socketSubs.add(sessionId);
    }

    // Update activity
    kdsLastActivity.set(socket.id, Date.now());

    // Track room join in connection tracker
    trackSocketJoinRoom(socket.id, roomName);
    trackSocketJoinRoom(socket.id, `session:${sessionId}`);

    // Update activity
    updateSocketActivity(socket.id);

    logger.info({ socketId: socket.id, staffId, sessionId }, 'KDS joined session');
    socket.emit('kds:joined', { sessionId, timestamp: new Date().toISOString() });
  }));

  /**
   * Leave KDS session room
   * Payload: { sessionId: string }
   */
  socket.on('kds:leave', rateLimitMiddleware(socket, 'kds:leave', (sessionId: string) => {
    if (!sessionId || typeof sessionId !== 'string') {
      socket.emit('kds:error', { message: 'INVALID_SESSION_ID' });
      return;
    }

    const roomName = `kitchen:session:${sessionId}`;
    socket.leave(roomName);
    socket.leave(`session:${sessionId}`);

    // Remove from tracking
    const subs = kdsSessionSubscriptions.get(sessionId);
    if (subs) {
      subs.delete(socket.id);
      if (subs.size === 0) {
        kdsSessionSubscriptions.delete(sessionId);
      }
    }

    // Remove from socket's subscription tracking
    const socketSubs = socketSubscriptions.get(socket.id);
    if (socketSubs) {
      socketSubs.delete(sessionId);
    }

    // Update activity
    kdsLastActivity.set(socket.id, Date.now());

    // Track room leave in connection tracker
    trackSocketLeaveRoom(socket.id, roomName);
    trackSocketLeaveRoom(socket.id, `session:${sessionId}`);

    // Update activity
    updateSocketActivity(socket.id);

    logger.info({ socketId: socket.id, staffId, sessionId }, 'KDS left session');
    socket.emit('kds:left', { sessionId });
  }));

  // ==================== ITEM MANAGEMENT ====================

  /**
   * Mark item as being prepared
   * Payload: { itemId: string }
   */
  socket.on('kds:item_prepare', rateLimitMiddleware(socket, 'kds:item_prepare', async ({ itemId }: { itemId: string }) => {
    try {
      if (!itemId || typeof itemId !== 'string') {
        socket.emit('kds:error', { message: 'INVALID_ITEM_ID', itemId });
        return;
      }

      // Update activity
      kdsLastActivity.set(socket.id, Date.now());

      // Get item first to check type
      const itemToUpdate = await ItemOrder.findById(itemId);
      if (!itemToUpdate) {
        socket.emit('kds:error', { message: 'ITEM_NOT_FOUND', itemId });
        return;
      }

      // KDS only handles KITCHEN items
      if (itemToUpdate.item_disher_type === 'SERVICE') {
        socket.emit('kds:error', {
          message: 'INVALID_ITEM_TYPE',
          itemId,
          details: 'SERVICE items do not go through kitchen preparation'
        });
        return;
      }

      const prepareSessionId = itemToUpdate.session_id.toString();

      // Verify socket has joined this session (authorization check)
      const prepareSessionSubs = kdsSessionSubscriptions.get(prepareSessionId);
      if (!prepareSessionSubs || !prepareSessionSubs.has(socket.id)) {
        socket.emit('kds:error', { message: 'UNAUTHORIZED', details: 'Must join session before operating on items' });
        return;
      }

      let item;
      try {
        item = await updateItemState(itemId, 'ON_PREPARE', staffId, user.permissions, 'KDS') as IItemOrder;
      } catch (serviceError: any) {
        socket.emit('kds:error', { message: serviceError.message || 'UPDATE_FAILED', itemId });
        return;
      }

      const sessionId = item.session_id.toString();

      // Notify TAS (waiters) about kitchen state change
      emitToTAS(sessionId, 'tas:kitchen_item_update', {
        itemId: item._id,
        itemName: item.item_name_snapshot,
        newState: 'ON_PREPARE',
        updatedBy: staffId,
        updatedByName: user.name,
        timestamp: new Date().toISOString(),
      });

      socket.emit('kds:item_prepared', { itemId, newState: 'ON_PREPARE' });
      logger.info({ itemId, staffId, sessionId }, 'Item marked as ON_PREPARE');
    } catch (err: any) {
      logger.error({ err, itemId, staffId }, 'kds:item_prepare error');
      socket.emit('kds:error', {
        message: 'INTERNAL_ERROR',
        itemId,
      });
    }
  }));

  /**
   * Cancel an item (only if in ORDERED state)
   * Payload: { itemId: string, reason?: string }
   */
  socket.on('kds:item_cancel', rateLimitMiddleware(socket, 'kds:item_cancel', async ({ itemId, reason }: { itemId: string; reason?: string }) => {
    try {
      if (!itemId || typeof itemId !== 'string') {
        socket.emit('kds:error', { message: 'INVALID_ITEM_ID', itemId });
        return;
      }

      // Update activity
      kdsLastActivity.set(socket.id, Date.now());

      // Get item to verify state
      const itemToCancel = await ItemOrder.findById(itemId);
      if (!itemToCancel) {
        socket.emit('kds:error', { message: 'ITEM_NOT_FOUND', itemId });
        return;
      }

      // Only allow cancellation if item is in ORDERED state
      if (itemToCancel.item_state !== 'ORDERED') {
        socket.emit('kds:error', {
          message: 'CANNOT_CANCEL',
          itemId,
          details: `Cannot cancel item in ${itemToCancel.item_state} state. Only ORDERED items can be cancelled.`
        });
        return;
      }

      const cancelSessionId = itemToCancel.session_id.toString();

      // Verify socket has joined this session
      const cancelSessionSubs = kdsSessionSubscriptions.get(cancelSessionId);
      if (!cancelSessionSubs || !cancelSessionSubs.has(socket.id)) {
        socket.emit('kds:error', { message: 'UNAUTHORIZED', details: 'Must join session before operating on items' });
        return;
      }

      let item;
      try {
        item = await updateItemState(itemId, 'CANCELED', staffId, user.permissions, 'KDS') as IItemOrder;
      } catch (serviceError: any) {
        socket.emit('kds:error', { message: serviceError.message || 'UPDATE_FAILED', itemId });
        return;
      }

      const sessionId = item.session_id.toString();

      // Notify TAS (waiters) about cancellation
      emitToTAS(sessionId, 'tas:kitchen_item_update', {
        itemId: item._id,
        itemName: item.item_name_snapshot,
        newState: 'CANCELED',
        updatedBy: staffId,
        updatedByName: user.name,
        reason: reason || 'Cancelled by kitchen',
        timestamp: new Date().toISOString(),
      });

      socket.emit('kds:item_canceled', { itemId, newState: 'CANCELED' });
      logger.info({ itemId, staffId, sessionId, reason }, 'Item marked as CANCELED by KDS');
    } catch (err: any) {
      logger.error({ err, itemId, staffId }, 'kds:item_cancel error');
      socket.emit('kds:error', {
        message: 'INTERNAL_ERROR',
        itemId,
      });
    }
  }));

  /**
   * Mark item as served/ready
   * Payload: { itemId: string }
   */
  socket.on('kds:item_serve', rateLimitMiddleware(socket, 'kds:item_serve', async ({ itemId }: { itemId: string }) => {
    try {
      if (!itemId || typeof itemId !== 'string') {
        socket.emit('kds:error', { message: 'INVALID_ITEM_ID', itemId });
        return;
      }

      // Update activity
      kdsLastActivity.set(socket.id, Date.now());

      // Get item to determine valid previous states
      const itemToUpdate = await ItemOrder.findById(itemId);
      if (!itemToUpdate) {
        socket.emit('kds:error', { message: 'ITEM_NOT_FOUND', itemId });
        return;
      }

      const serveSessionId = itemToUpdate.session_id.toString();

      // Verify socket has joined this session
      const serveSessionSubs = kdsSessionSubscriptions.get(serveSessionId);
      if (!serveSessionSubs || !serveSessionSubs.has(socket.id)) {
        socket.emit('kds:error', { message: 'UNAUTHORIZED', details: 'Must join session before operating on items' });
        return;
      }

      let item;
      try {
        item = await updateItemState(itemId, 'SERVED', staffId, user.permissions, 'KDS') as IItemOrder;
      } catch (serviceError: any) {
        socket.emit('kds:error', { message: serviceError.message || 'UPDATE_FAILED', itemId });
        return;
      }

      const sessionId = item.session_id.toString();

      // Notify TAS (waiters) about kitchen state change
      emitToTAS(sessionId, 'tas:kitchen_item_update', {
        itemId: item._id,
        itemName: item.item_name_snapshot,
        newState: 'SERVED',
        updatedBy: staffId,
        updatedByName: user.name,
        timestamp: new Date().toISOString(),
      });

      socket.emit('kds:item_served', { itemId, newState: 'SERVED' });
      logger.info({ itemId, staffId, sessionId }, 'Item marked as SERVED');
    } catch (err: any) {
      logger.error({ err, itemId, staffId }, 'kds:item_serve error');
      socket.emit('kds:error', {
        message: 'INTERNAL_ERROR',
        itemId,
      });
    }
  }));

  // ==================== DISCONNECT ====================

  socket.on('disconnect', () => {
    try {
      // Clean up subscriptions using the socket subscription tracking
      const sessions = socketSubscriptions.get(socket.id);
      if (sessions) {
        sessions.forEach(sessionId => {
          const socketIds = kdsSessionSubscriptions.get(sessionId);
          if (socketIds) {
            socketIds.delete(socket.id);
            if (socketIds.size === 0) {
              kdsSessionSubscriptions.delete(sessionId);
            }
            logger.info({ socketId: socket.id, staffId, sessionId }, 'KDS disconnected, removed from session');
          }
        });
        socketSubscriptions.delete(socket.id);
      }

      // Clean up activity tracking
      kdsLastActivity.delete(socket.id);

      // Remove all listeners registered by this socket to prevent memory leaks
      socket.removeAllListeners();

      // Clean up connection tracking
      cleanupSocketConnection(socket.id);


      logger.info({ socketId: socket.id, staffId }, 'KDS client disconnected and cleaned up');
    } catch (err) {
      logger.error({ err, socketId: socket.id, staffId }, 'Error during KDS disconnect cleanup');
    }
  });
}

// ==================== EXPORTED HELPERS ====================

/**
 * Emit event to all KDS in a session
 */
export function emitToKDS(sessionId: string, event: string, data: any): void {
  try {
    const io = getIO();
    io.to(`kitchen:session:${sessionId}`).emit(event, data);
    logger.debug({ sessionId, event }, 'Emitted event to KDS');
  } catch (err) {
    logger.error({ err, sessionId, event }, 'Failed to emit event to KDS');
  }
}

/**
 * Emit event to TAS in a session
 */
function emitToTAS(sessionId: string, event: string, data: any): void {
  try {
    const io = getIO();
    io.to(`tas:session:${sessionId}`).emit(event, data);
    logger.debug({ sessionId, event }, 'Emitted event to TAS');
  } catch (err) {
    logger.error({ err, sessionId, event }, 'Failed to emit event to TAS');
  }
}

/**
 * Notify KDS of new kitchen items
 */
export function notifyKDSNewItem(sessionId: string, itemData: any): void {
  emitToKDS(sessionId, 'kds:new_item', {
    ...itemData,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Notify KDS when item is canceled
 */
export function notifyKDSItemCanceled(sessionId: string, itemData: any): void {
  emitToKDS(sessionId, 'kds:item_canceled', {
    ...itemData,
    timestamp: new Date().toISOString(),
  });
}

export { kdsSessionSubscriptions };
