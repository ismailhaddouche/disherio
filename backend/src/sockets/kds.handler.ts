import { Server } from 'socket.io';
import { ItemOrder } from '../models/order.model';
import { logger } from '../config/logger';
import { AuthenticatedSocket } from '../middlewares/socketAuth';
import { createSocketRateLimiter, rateLimitWrapper } from '../middlewares/socketRateLimit';
import { getIO } from '../config/socket';

/**
 * KDS (Kitchen Display System) Socket Handler
 * 
 * Handles real-time communication for kitchen staff:
 * - Receives: Item preparation events
 * - Emits: Item state changes to TAS and general session
 */

// Track active KDS subscriptions per session
const kdsSessionSubscriptions = new Map<string, Set<string>>(); // sessionId -> Set of socketIds

export function registerKdsHandlers(_io: Server, socket: AuthenticatedSocket): void {
  // Verify user has kitchen permissions (KTS = Kitchen Table Service)
  const user = socket.user;
  if (!user || !user.permissions.includes('KTS')) {
    logger.warn({ socketId: socket.id }, 'Unauthorized KDS connection attempt');
    return;
  }

  const staffId = user.staffId;
  const rateLimiter = createSocketRateLimiter();

  logger.info({ socketId: socket.id, staffId }, 'KDS client connected');

  // ==================== SESSION MANAGEMENT ====================

  /**
   * Join KDS session room
   * Payload: { sessionId: string }
   */
  socket.on('kds:join', rateLimitWrapper(rateLimiter, socket, 'kds:join', (sessionId: string) => {
    if (!sessionId || typeof sessionId !== 'string') {
      socket.emit('kds:error', { message: 'INVALID_SESSION_ID' });
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

    logger.info({ socketId: socket.id, staffId, sessionId }, 'KDS joined session');
    socket.emit('kds:joined', { sessionId, timestamp: new Date().toISOString() });
  }));

  /**
   * Leave KDS session room
   * Payload: { sessionId: string }
   */
  socket.on('kds:leave', rateLimitWrapper(rateLimiter, socket, 'kds:leave', (sessionId: string) => {
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

    logger.info({ socketId: socket.id, staffId, sessionId }, 'KDS left session');
    socket.emit('kds:left', { sessionId });
  }));

  // ==================== ITEM MANAGEMENT ====================

  /**
   * Mark item as being prepared
   * Payload: { itemId: string }
   */
  socket.on('kds:item_prepare', rateLimitWrapper(rateLimiter, socket, 'kds:item_prepare', async ({ itemId }: { itemId: string }) => {
    try {
      if (!itemId || typeof itemId !== 'string') {
        socket.emit('kds:error', { message: 'INVALID_ITEM_ID', itemId });
        return;
      }

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

      // Atomic update to prevent race conditions
      const item = await ItemOrder.findOneAndUpdate(
        { _id: itemId, item_state: 'ORDERED', item_disher_type: 'KITCHEN' },
        { item_state: 'ON_PREPARE' },
        { new: true }
      );

      if (!item) {
        logger.warn({ itemId, staffId }, 'Item not found or not in ORDERED state');
        socket.emit('kds:error', { 
          message: 'ITEM_NOT_FOUND_OR_INVALID_STATE', 
          itemId,
          details: 'Item may not exist or is not in ORDERED state'
        });
        return;
      }

      const sessionId = item.session_id.toString();

      // Emit to general session
      emitToSession(sessionId, 'item:state_changed', {
        itemId: item._id,
        newState: 'ON_PREPARE',
        updatedBy: 'KDS',
        updatedByStaffId: staffId,
      });

      // Notify TAS (waiters) about kitchen state change
      emitToTAS(sessionId, 'tas:kitchen_item_update', {
        itemId: item._id,
        itemName: item.item_name_snapshot,
        newState: 'ON_PREPARE',
        updatedBy: staffId,
        updatedByName: user.name,
        timestamp: new Date().toISOString(),
      });

      // Notify customers
      emitToCustomers(sessionId, 'order:item_update', {
        itemId: item._id,
        itemName: item.item_name_snapshot,
        newState: 'ON_PREPARE',
        timestamp: new Date().toISOString(),
      });

      socket.emit('kds:item_prepared', { itemId, newState: 'ON_PREPARE' });
      logger.info({ itemId, staffId, sessionId }, 'Item marked as ON_PREPARE');
    } catch (err: any) {
      logger.error({ err, itemId, staffId }, 'kds:item_prepare error');
      socket.emit('kds:error', { 
        message: 'INTERNAL_ERROR', 
        itemId,
        details: err.message 
      });
    }
  }));

  /**
   * Cancel an item (only if in ORDERED state)
   * Payload: { itemId: string, reason?: string }
   */
  socket.on('kds:item_cancel', rateLimitWrapper(rateLimiter, socket, 'kds:item_cancel', async ({ itemId, reason }: { itemId: string; reason?: string }) => {
    try {
      if (!itemId || typeof itemId !== 'string') {
        socket.emit('kds:error', { message: 'INVALID_ITEM_ID', itemId });
        return;
      }

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

      // Update item state to CANCELED
      const item = await ItemOrder.findOneAndUpdate(
        { _id: itemId, item_state: 'ORDERED' },
        { item_state: 'CANCELED' },
        { new: true }
      );

      if (!item) {
        socket.emit('kds:error', { 
          message: 'ITEM_NOT_FOUND_OR_INVALID_STATE', 
          itemId,
          details: 'Item may have been updated by another user'
        });
        return;
      }

      const sessionId = item.session_id.toString();

      // Emit to general session
      emitToSession(sessionId, 'item:state_changed', {
        itemId: item._id,
        newState: 'CANCELED',
        updatedBy: 'KDS',
        updatedByStaffId: staffId,
        reason: reason || 'Cancelled by kitchen',
      });

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

      // Notify customers
      emitToCustomers(sessionId, 'order:item_update', {
        itemId: item._id,
        itemName: item.item_name_snapshot,
        newState: 'CANCELED',
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
        details: err.message 
      });
    }
  }));

  /**
   * Mark item as served/ready
   * Payload: { itemId: string }
   */
  socket.on('kds:item_serve', rateLimitWrapper(rateLimiter, socket, 'kds:item_serve', async ({ itemId }: { itemId: string }) => {
    try {
      if (!itemId || typeof itemId !== 'string') {
        socket.emit('kds:error', { message: 'INVALID_ITEM_ID', itemId });
        return;
      }

      // Get item to determine valid previous states
      const itemToUpdate = await ItemOrder.findById(itemId);
      if (!itemToUpdate) {
        socket.emit('kds:error', { message: 'ITEM_NOT_FOUND', itemId });
        return;
      }

      // KITCHEN items must be ON_PREPARE, SERVICE items can be ORDERED
      const validPreviousState = itemToUpdate.item_disher_type === 'SERVICE' 
        ? 'ORDERED' 
        : 'ON_PREPARE';

      // Atomic update to prevent race conditions
      const item = await ItemOrder.findOneAndUpdate(
        { _id: itemId, item_state: validPreviousState },
        { item_state: 'SERVED' },
        { new: true }
      );

      if (!item) {
        logger.warn({ itemId, staffId }, `Item not found or not in ${validPreviousState} state`);
        socket.emit('kds:error', { 
          message: 'ITEM_NOT_FOUND_OR_INVALID_STATE', 
          itemId,
          details: `Item may not exist or is not in ${validPreviousState} state`
        });
        return;
      }

      const sessionId = item.session_id.toString();
      
      // Emit to general session
      emitToSession(sessionId, 'item:state_changed', {
        itemId: item._id,
        newState: 'SERVED',
        updatedBy: 'KDS',
        updatedByStaffId: staffId,
      });

      // Notify TAS (waiters) about kitchen state change
      emitToTAS(sessionId, 'tas:kitchen_item_update', {
        itemId: item._id,
        itemName: item.item_name_snapshot,
        newState: 'SERVED',
        updatedBy: staffId,
        updatedByName: user.name,
        timestamp: new Date().toISOString(),
      });

      // Notify customers
      emitToCustomers(sessionId, 'order:item_update', {
        itemId: item._id,
        itemName: item.item_name_snapshot,
        newState: 'SERVED',
        timestamp: new Date().toISOString(),
      });

      socket.emit('kds:item_served', { itemId, newState: 'SERVED' });
      logger.info({ itemId, staffId, sessionId }, 'Item marked as SERVED');
    } catch (err: any) {
      logger.error({ err, itemId, staffId }, 'kds:item_serve error');
      socket.emit('kds:error', { 
        message: 'INTERNAL_ERROR', 
        itemId,
        details: err.message 
      });
    }
  }));

  // ==================== DISCONNECT ====================

  socket.on('disconnect', () => {
    // Clean up subscriptions
    for (const [sessionId, socketIds] of kdsSessionSubscriptions.entries()) {
      if (socketIds.has(socket.id)) {
        socketIds.delete(socket.id);
        if (socketIds.size === 0) {
          kdsSessionSubscriptions.delete(sessionId);
        }
        logger.info({ socketId: socket.id, staffId, sessionId }, 'KDS disconnected, removed from session');
      }
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
 * Emit event to general session room
 */
function emitToSession(sessionId: string, event: string, data: any): void {
  try {
    const io = getIO();
    io.to(`session:${sessionId}`).emit(event, data);
    logger.debug({ sessionId, event }, 'Emitted event to session');
  } catch (err) {
    logger.error({ err, sessionId, event }, 'Failed to emit event to session');
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
 * Emit event to customers in a session
 */
function emitToCustomers(sessionId: string, event: string, data: any): void {
  try {
    const io = getIO();
    io.to(`customer:session:${sessionId}`).emit(event, data);
    logger.debug({ sessionId, event }, 'Emitted event to customers');
  } catch (err) {
    logger.error({ err, sessionId, event }, 'Failed to emit event to customers');
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
