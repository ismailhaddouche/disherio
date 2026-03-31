import { Server } from 'socket.io';
import i18next from 'i18next';
import { ItemOrder, IItemOrder } from '../models/order.model';
import { logger } from '../config/logger';
import { AuthenticatedSocket } from '../middlewares/socketAuth';
import { createSocketRateLimiter, rateLimitWrapper } from '../middlewares/socketRateLimit';
import { getIO } from '../config/socket';
import { notifyCustomerFromWaiter, closeSessionForCustomers } from './totem.handler';
import { notifyKDSNewItem, notifyKDSItemCanceled } from './kds.handler';

/**
 * TAS (Table Assistance Service) Socket Handler
 * 
 * Handles real-time communication for waiters/table assistance:
 * - Receives: Events from customers (new orders, help requests) and kitchen (item state changes)
 * - Emits: New items added, service items served, bill requests, session updates
 */

// Track active TAS subscriptions per session
const tasSessionSubscriptions = new Map<string, Set<string>>(); // sessionId -> Set of socketIds

export function registerTasHandlers(io: Server, socket: AuthenticatedSocket): void {
  const user = socket.user;
  
  // Verify user has TAS permission
  if (!user || !user.permissions.includes('TAS')) {
    logger.warn({ socketId: socket.id }, 'Unauthorized TAS connection attempt');
    return;
  }

  const rateLimiter = createSocketRateLimiter();
  const staffId = user.staffId;

  logger.info({ socketId: socket.id, staffId }, 'TAS client connected');

  // ==================== SESSION MANAGEMENT ====================

  /**
   * Join TAS session room and subscribe to all events for this session
   * Payload: { sessionId: string }
   */
  socket.on('tas:join', rateLimitWrapper(rateLimiter, socket, 'tas:join', (sessionId: string) => {
    if (!sessionId || typeof sessionId !== 'string') {
      socket.emit('tas:error', { message: 'INVALID_SESSION_ID' });
      return;
    }

    const roomName = `tas:session:${sessionId}`;
    socket.join(roomName);
    
    // Track subscription
    if (!tasSessionSubscriptions.has(sessionId)) {
      tasSessionSubscriptions.set(sessionId, new Set());
    }
    tasSessionSubscriptions.get(sessionId)!.add(socket.id);

    logger.info({ socketId: socket.id, staffId, sessionId }, 'TAS joined session');
    socket.emit('tas:joined', { sessionId, timestamp: new Date().toISOString() });
  }));

  /**
   * Leave TAS session room
   * Payload: { sessionId: string }
   */
  socket.on('tas:leave', rateLimitWrapper(rateLimiter, socket, 'tas:leave', (sessionId: string) => {
    if (!sessionId || typeof sessionId !== 'string') {
      socket.emit('tas:error', { message: 'INVALID_SESSION_ID' });
      return;
    }

    const roomName = `tas:session:${sessionId}`;
    socket.leave(roomName);
    
    // Remove from tracking
    const subs = tasSessionSubscriptions.get(sessionId);
    if (subs) {
      subs.delete(socket.id);
      if (subs.size === 0) {
        tasSessionSubscriptions.delete(sessionId);
      }
    }

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
  socket.on('tas:add_item', rateLimitWrapper(rateLimiter, socket, 'tas:add_item', async (data: {
    sessionId: string;
    orderId: string;
    dishId: string;
    customerId?: string;
    variantId?: string;
    extras?: string[];
    itemData: Partial<IItemOrder>;
  }) => {
    try {
      const { sessionId, orderId, itemData } = data;

      if (!sessionId || !orderId || !itemData) {
        socket.emit('tas:error', { message: 'INVALID_DATA', details: 'Missing required fields' });
        return;
      }

      // Create the item (this would typically be done via the order service)
      // For now, we assume the item is created and we broadcast it
      const newItem = {
        ...itemData,
        order_id: orderId,
        session_id: sessionId,
        item_state: 'ORDERED',
        added_by: staffId,
        added_at: new Date().toISOString(),
      };

      // 1. Emit to TAS room for this session (other waiters)
      io.to(`tas:session:${sessionId}`).emit('tas:item_added', {
        item: newItem,
        addedBy: staffId,
        addedByName: user.name,
        timestamp: new Date().toISOString(),
      });

      // 2. Emit to POS (cashier station)
      io.to(`pos:session:${sessionId}`).emit('pos:item_added', {
        item: newItem,
        addedBy: 'waiter',
        waiterName: user.name,
        timestamp: new Date().toISOString(),
      });

      // 3. Emit to customer room (so customers see new items in real-time)
      emitToCustomers(sessionId, 'order:item_added', {
        item: newItem,
        addedBy: 'waiter',
        waiterName: user.name,
      });

      // 4. If it's a kitchen item, emit to kitchen (KDS)
      if (itemData.item_disher_type === 'KITCHEN') {
        notifyKDSNewItem(sessionId, newItem);
      }

      // 5. Emit generic item:added for compatibility
      io.to(`session:${sessionId}`).emit('item:added', {
        item: newItem,
        addedBy: 'TAS',
        staffId,
        timestamp: new Date().toISOString(),
      });

      socket.emit('tas:item_added_confirm', { 
        success: true, 
        sessionId,
        timestamp: new Date().toISOString(),
      });

      logger.info({ sessionId, staffId, itemType: itemData.item_disher_type }, 'TAS added item');
    } catch (err: any) {
      logger.error({ err, staffId }, 'tas:add_item error');
      socket.emit('tas:error', { message: 'INTERNAL_ERROR', details: err.message });
    }
  }));

  /**
   * Mark a SERVICE item (drinks, etc.) as served
   * Kitchen items are handled by KDS handler
   * Payload: { itemId: string }
   */
  socket.on('tas:serve_service_item', rateLimitWrapper(rateLimiter, socket, 'tas:serve_service_item', async ({ itemId }: { itemId: string }) => {
    try {
      if (!itemId || typeof itemId !== 'string') {
        socket.emit('tas:error', { message: 'INVALID_ITEM_ID' });
        return;
      }

      // Find and update the item atomically
      const item = await ItemOrder.findOneAndUpdate(
        { 
          _id: itemId, 
          item_disher_type: 'SERVICE',  // Only SERVICE items
          item_state: 'ORDERED'         // Only from ORDERED state
        },
        { item_state: 'SERVED' },
        { new: true }
      );

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

      // Also emit generic state change for compatibility
      io.to(`session:${sessionId}`).emit('item:state_changed', {
        itemId: item._id,
        newState: 'SERVED',
        servedBy: 'TAS',
      });

      socket.emit('tas:item_served_confirm', { 
        success: true, 
        itemId, 
        newState: 'SERVED' 
      });

      logger.info({ itemId, staffId, sessionId }, 'TAS served SERVICE item');
    } catch (err: any) {
      logger.error({ err, itemId, staffId }, 'tas:serve_service_item error');
      socket.emit('tas:error', { message: 'INTERNAL_ERROR', details: err.message });
    }
  }));

  /**
   * Cancel an item (waiter cancels an item from the order)
   * Payload: { itemId: string, reason?: string }
   */
  socket.on('tas:cancel_item', rateLimitWrapper(rateLimiter, socket, 'tas:cancel_item', async ({ itemId, reason }: { itemId: string; reason?: string }) => {
    try {
      if (!itemId || typeof itemId !== 'string') {
        socket.emit('tas:error', { message: 'INVALID_ITEM_ID' });
        return;
      }

      const item = await ItemOrder.findOneAndUpdate(
        { _id: itemId, item_state: { $in: ['ORDERED', 'ON_PREPARE'] } },
        { item_state: 'CANCELED' },
        { new: true }
      );

      if (!item) {
        socket.emit('tas:error', { 
          message: 'ITEM_NOT_FOUND_OR_INVALID_STATE',
          details: 'Item may not exist or is already served/canceled'
        });
        return;
      }

      const sessionId = item.session_id.toString();

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
    } catch (err: any) {
      logger.error({ err, itemId, staffId }, 'tas:cancel_item error');
      socket.emit('tas:error', { message: 'INTERNAL_ERROR', details: err.message });
    }
  }));

  // ==================== BILL & PAYMENT ====================

  /**
   * Request bill/check for a session
   * Payload: { sessionId: string, requestedBy: 'waiter' | 'customer', customerId?: string }
   */
  socket.on('tas:request_bill', rateLimitWrapper(rateLimiter, socket, 'tas:request_bill', async (data: {
    sessionId: string;
    requestedBy: 'waiter' | 'customer';
    customerId?: string;
    splitType?: 'ALL' | 'BY_USER' | 'SHARED';
    closeForCustomers?: boolean; // Whether to close session for customers (default: true)
  }) => {
    try {
      const { sessionId, requestedBy, customerId, splitType, closeForCustomers } = data;

      if (!sessionId) {
        socket.emit('tas:error', { message: 'INVALID_SESSION_ID' });
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

      // Close session for customers by default (prevents new orders)
      if (closeForCustomers !== false) {
        await closeSessionForCustomers(sessionId, {
          closedBy: requestedBy === 'waiter' ? 'waiter' : 'pos',
          closedByName: user.name,
          reason: i18next.t(requestedBy === 'waiter' ? 'sockets:BILL_REQUESTED_BY_WAITER' : 'sockets:BILL_REQUESTED_BY_CUSTOMER'),
        });
      }

      socket.emit('tas:bill_request_confirm', { success: true, sessionId });
      logger.info({ sessionId, staffId, requestedBy }, 'Bill requested - session closed for customers');
    } catch (err: any) {
      logger.error({ err, staffId }, 'tas:request_bill error');
      socket.emit('tas:error', { message: 'INTERNAL_ERROR', details: err.message });
    }
  }));

  /**
   * Mark bill as paid / Close session
   * Payload: { sessionId: string, paymentData: object }
   */
  socket.on('tas:bill_paid', rateLimitWrapper(rateLimiter, socket, 'tas:bill_paid', (data: {
    sessionId: string;
    paymentTotal: number;
    paymentType: 'ALL' | 'BY_USER' | 'SHARED';
    tickets: any[];
  }) => {
    try {
      const { sessionId, paymentTotal, paymentType, tickets } = data;

      if (!sessionId) {
        socket.emit('tas:error', { message: 'INVALID_SESSION_ID' });
        return;
      }

      const paymentInfo = {
        sessionId,
        paidBy: staffId,
        paymentTotal,
        paymentType,
        tickets,
        timestamp: new Date().toISOString(),
      };

      // Notify TAS in session
      io.to(`tas:session:${sessionId}`).emit('tas:bill_paid', paymentInfo);

      // Notify POS
      io.to(`pos:session:${sessionId}`).emit('pos:bill_paid', paymentInfo);

      // Notify customers
      emitToCustomers(sessionId, 'bill:paid', {
        paymentTotal,
        paymentType,
        timestamp: paymentInfo.timestamp,
      });

      socket.emit('tas:bill_paid_confirm', { success: true, sessionId });
      logger.info({ sessionId, staffId, paymentTotal }, 'Bill marked as paid');
    } catch (err: any) {
      logger.error({ err, staffId }, 'tas:bill_paid error');
      socket.emit('tas:error', { message: 'INTERNAL_ERROR', details: err.message });
    }
  }));

  // ==================== CUSTOMER SERVICE ====================

  /**
   * Customer calls waiter (this is received from customer client and forwarded to TAS)
   * Note: This event is typically emitted by customer clients, TAS receives it
   */
  socket.on('tas:call_waiter_response', rateLimitWrapper(rateLimiter, socket, 'tas:call_waiter_response', (data: {
    sessionId: string;
    customerId?: string;
    tableId?: string;
    acknowledged: boolean;
    message?: string;
  }) => {
    try {
      const { sessionId, acknowledged, message } = data;

      // Acknowledge the call
      if (acknowledged) {
        emitToCustomers(sessionId, 'waiter:acknowledged', {
          staffId,
          staffName: user.name,
          message: message || i18next.t('sockets:WAITER_COMING_ASSIST'),
          timestamp: new Date().toISOString(),
        });

        socket.emit('tas:call_acknowledged_confirm', { success: true, sessionId });
        logger.info({ sessionId, staffId }, 'Waiter acknowledged customer call');
      }
    } catch (err: any) {
      logger.error({ err, staffId }, 'tas:call_waiter_response error');
      socket.emit('tas:error', { message: 'INTERNAL_ERROR', details: err.message });
    }
  }));

  /**
   * Send message to customers at a table
   * Payload: { sessionId: string, message: string, type?: 'info' | 'warning' | 'success' }
   */
  socket.on('tas:notify_customers', rateLimitWrapper(rateLimiter, socket, 'tas:notify_customers', (data: {
    sessionId: string;
    message: string;
    type?: 'info' | 'warning' | 'success';
  }) => {
    try {
      const { sessionId, message, type } = data;

      if (!sessionId || !message) {
        socket.emit('tas:error', { message: 'INVALID_DATA' });
        return;
      }

      notifyCustomerFromWaiter(sessionId, message, user.name, type || 'info');

      socket.emit('tas:notify_confirm', { success: true, sessionId });
      logger.info({ sessionId, staffId }, 'TAS notified customers');
    } catch (err: any) {
      logger.error({ err, staffId }, 'tas:notify_customers error');
      socket.emit('tas:error', { message: 'INTERNAL_ERROR', details: err.message });
    }
  }));

  // ==================== DISCONNECT ====================

  socket.on('disconnect', () => {
    // Clean up subscriptions
    for (const [sessionId, socketIds] of tasSessionSubscriptions.entries()) {
      if (socketIds.has(socket.id)) {
        socketIds.delete(socket.id);
        if (socketIds.size === 0) {
          tasSessionSubscriptions.delete(sessionId);
        }
        logger.info({ socketId: socket.id, staffId, sessionId }, 'TAS disconnected, removed from session');
      }
    }
  });
}

// ==================== EXPORTED HELPERS ====================

/**
 * Helper function to emit events to TAS from other parts of the system
 * (e.g., when a customer places an order via totem)
 */
export function emitToTAS(sessionId: string, event: string, data: any): void {
  try {
    const io = getIO();
    io.to(`tas:session:${sessionId}`).emit(event, data);
    logger.debug({ sessionId, event }, 'Emitted event to TAS');
  } catch (err) {
    logger.error({ err, sessionId, event }, 'Failed to emit event to TAS');
  }
}

/**
 * Notify TAS when a customer places a new order via totem/app
 */
export function notifyTASNewOrder(sessionId: string, orderData: any): void {
  emitToTAS(sessionId, 'tas:new_customer_order', {
    ...orderData,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Notify TAS when a customer requests help
 */
export function notifyTASHelpRequest(sessionId: string, customerData: any): void {
  emitToTAS(sessionId, 'tas:help_requested', {
    ...customerData,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Notify TAS when a customer requests the bill from their device
 */
export function notifyTASBillRequest(sessionId: string, customerData: any): void {
  emitToTAS(sessionId, 'tas:customer_bill_request', {
    ...customerData,
    timestamp: new Date().toISOString(),
  });
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

export { tasSessionSubscriptions };
