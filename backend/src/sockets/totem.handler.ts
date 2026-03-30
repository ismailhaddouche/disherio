import { Server } from 'socket.io';
import i18next from 'i18next';

import { logger } from '../config/logger';
import { AuthenticatedSocket } from '../middlewares/socketAuth';
import { createSocketRateLimiter, rateLimitWrapper } from '../middlewares/socketRateLimit';
import { getIO } from '../config/socket';
import { notifyTASNewOrder, notifyTASHelpRequest, notifyTASBillRequest } from './tas.handler';
import { notifyKDSNewItem } from './kds.handler';
import { TotemSessionRepository } from '../repositories';

/**
 * Totem/Customer Socket Handler
 * 
 * Handles real-time communication for customers using totems or mobile devices:
 * - Join session rooms (via QR scan)
 * - Place orders
 * - Request help
 * - Request bill
 * - Receive notifications from waiters
 */

// Repository instance
const totemSessionRepo = new TotemSessionRepository();

// Track active customer sessions (WebSocket connections only)
const customerSessions = new Map<string, string>(); // socketId -> sessionId
const sessionCustomers = new Map<string, Set<string>>(); // sessionId -> Set of socketIds
const customerInfo = new Map<string, { 
  customerId?: string; 
  customerName: string; 
  socketId: string;
  joinedAt: string;
}>(); // socketId -> customer info

// Get all customers in a session
function getSessionCustomers(sessionId: string): Array<{ customerId?: string; customerName: string; socketId: string; joinedAt: string }> {
  const socketIds = sessionCustomers.get(sessionId);
  if (!socketIds) return [];
  
  return Array.from(socketIds)
    .map(socketId => customerInfo.get(socketId))
    .filter((info): info is NonNullable<typeof info> => info !== undefined);
}

// Check if session is closed (bill requested) - uses database state
export async function isSessionClosed(sessionId: string): Promise<boolean> {
  try {
    const session = await totemSessionRepo.findById(sessionId);
    return session ? session.totem_state !== 'STARTED' : true;
  } catch (err) {
    logger.error({ err, sessionId }, 'Error checking session state');
    return true; // Assume closed on error
  }
}

// Close session for all customers (when bill is requested) - updates database
export async function closeSessionForCustomers(sessionId: string, data: {
  closedBy: 'customer' | 'waiter' | 'pos' | 'system';
  closedByName?: string;
  totalAmount?: number;
  reason?: string;
}): Promise<void> {
  try {
    const io = getIO();
    
    // Update database state to COMPLETE (bill requested, waiting for payment)
    await totemSessionRepo.updateState(sessionId, 'COMPLETE');

    // Notify all customers at the table
    io.to(`customer:session:${sessionId}`).emit('totem:session_closed', {
      sessionId,
      closedBy: data.closedBy,
      closedByName: data.closedByName,
      totalAmount: data.totalAmount,
      reason: data.reason || i18next.t('sockets:BILL_REQUESTED'),
      message: i18next.t('sockets:SESSION_CLOSED_NO_MORE_ORDERS'),
      timestamp: new Date().toISOString(),
    });

    // Force disconnect all customers from the room after a short delay
    setTimeout(() => {
      const socketIds = sessionCustomers.get(sessionId);
      if (socketIds) {
        socketIds.forEach(socketId => {
          const socket = io.sockets.sockets.get(socketId);
          if (socket) {
            socket.leave(`customer:session:${sessionId}`);
            socket.emit('totem:force_disconnect', {
              reason: 'SESSION_CLOSED',
              message: i18next.t('sockets:SESSION_ENDED_THANK_YOU'),
            });
          }
        });
        
        // Clear tracking for this session
        sessionCustomers.delete(sessionId);
      }
    }, 5000); // Give 5 seconds for clients to show the message

    logger.info({ sessionId, closedBy: data.closedBy }, 'Session closed for customers');
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to close session for customers');
  }
}

// Reopen session (if needed, e.g., bill cancelled) - updates database
export async function reopenSession(sessionId: string): Promise<void> {
  try {
    await totemSessionRepo.updateState(sessionId, 'STARTED');
    logger.info({ sessionId }, 'Session reopened');
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to reopen session');
  }
}

export function registerTotemHandlers(io: Server, socket: AuthenticatedSocket): void {
  // Customers may not be authenticated (public QR access)
  // But we can identify them by their socket ID
  const socketId = socket.id;
  const rateLimiter = createSocketRateLimiter();

  logger.info({ socketId }, 'Customer/Totem client connected');

  // ==================== SESSION MANAGEMENT ====================

  /**
   * Customer joins a session room (after scanning QR)
   * Payload: { sessionId: string, customerName?: string }
   */
  socket.on('totem:join_session', rateLimitWrapper(rateLimiter, socket, 'totem:join_session', async (data: {
    sessionId: string;
    customerName?: string;
    customerId?: string;
  }) => {
    try {
      const { sessionId, customerName, customerId } = data;

      if (!sessionId || typeof sessionId !== 'string') {
        socket.emit('totem:error', { message: 'INVALID_SESSION_ID' });
        return;
      }

      // Check if session is already closed (bill requested)
      const sessionClosed = await isSessionClosed(sessionId);
      if (sessionClosed) {
        socket.emit('totem:error', { 
          message: 'SESSION_CLOSED',
          details: i18next.t('sockets:SESSION_CLOSED_NO_MORE_ORDERS'),
        });
        return;
      }

      // Leave previous session if any
      const previousSession = customerSessions.get(socketId);
      if (previousSession && previousSession !== sessionId) {
        socket.leave(`customer:session:${previousSession}`);
        const prevSet = sessionCustomers.get(previousSession);
        if (prevSet) {
          prevSet.delete(socketId);
          if (prevSet.size === 0) {
            sessionCustomers.delete(previousSession);
          }
        }
        // Notify others that this customer left
        const prevInfo = customerInfo.get(socketId);
        if (prevInfo) {
          emitToCustomers(previousSession, 'totem:customer_left_table', {
            sessionId: previousSession,
            customerId: prevInfo.customerId,
            customerName: prevInfo.customerName,
            leftAt: new Date().toISOString(),
          });
        }
        customerInfo.delete(socketId);
      }

      // Join new session
      const roomName = `customer:session:${sessionId}`;
      socket.join(roomName);
      
      // Track customer session
      customerSessions.set(socketId, sessionId);
      if (!sessionCustomers.has(sessionId)) {
        sessionCustomers.set(sessionId, new Set());
      }
      sessionCustomers.get(sessionId)!.add(socketId);

      // Store customer info
      const joinedAt = new Date().toISOString();
      customerInfo.set(socketId, { 
        customerId, 
        customerName: customerName || i18next.t('common:CUSTOMER', { defaultValue: 'Customer' }), 
        socketId,
        joinedAt,
      });

      logger.info({ socketId, sessionId, customerName }, 'Customer joined session');
      
      // Get current customers in session for the new customer
      const existingCustomers = getSessionCustomers(sessionId).filter(c => c.socketId !== socketId);
      
      socket.emit('totem:session_joined', { 
        sessionId, 
        customerName,
        customerId,
        otherCustomersAtTable: existingCustomers.map(c => ({ 
          customerId: c.customerId, 
          customerName: c.customerName,
          joinedAt: c.joinedAt,
        })),
        timestamp: joinedAt,
      });

      // Notify other customers at the same table that someone joined
      emitToCustomers(sessionId, 'totem:customer_joined_table', {
        sessionId,
        customerId,
        customerName: customerName || i18next.t('common:CUSTOMER', { defaultValue: 'Customer' }),
        joinedAt,
      });

      // Notify TAS that a customer joined
      io.to(`tas:session:${sessionId}`).emit('tas:customer_joined', {
        sessionId,
        customerName: customerName || i18next.t('common:CUSTOMER', { defaultValue: 'Customer' }),
        customerId,
        totalCustomersAtTable: sessionCustomers.get(sessionId)?.size || 1,
        timestamp: joinedAt,
      });

    } catch (err: any) {
      logger.error({ err, socketId }, 'totem:join_session error');
      socket.emit('totem:error', { message: 'INTERNAL_ERROR', details: err.message });
    }
  }));

  /**
   * Customer leaves session
   */
  socket.on('totem:leave_session', rateLimitWrapper(rateLimiter, socket, 'totem:leave_session', () => {
    try {
      const sessionId = customerSessions.get(socketId);
      if (sessionId) {
        socket.leave(`customer:session:${sessionId}`);
        
        const set = sessionCustomers.get(sessionId);
        if (set) {
          set.delete(socketId);
          if (set.size === 0) {
            sessionCustomers.delete(sessionId);
          }
        }
        
        customerSessions.delete(socketId);
        
        logger.info({ socketId, sessionId }, 'Customer left session');
        socket.emit('totem:session_left', { sessionId });
      }
    } catch (err: any) {
      logger.error({ err, socketId }, 'totem:leave_session error');
      socket.emit('totem:error', { message: 'INTERNAL_ERROR', details: err.message });
    }
  }));

  // ==================== ORDERS ====================

  /**
   * Customer places an order
   * Payload: { sessionId: string, items: Array<{dishId, quantity, variantId?, extras?}> }
   */
  socket.on('totem:place_order', rateLimitWrapper(rateLimiter, socket, 'totem:place_order', async (data: {
    sessionId: string;
    orderId: string;
    items: Array<{
      dishId: string;
      dishName: any;
      quantity: number;
      variantId?: string;
      variantName?: any;
      extras?: Array<{ extraId: string; extraName: any; price: number }>;
      price: number;
      dishType: 'KITCHEN' | 'SERVICE';
    }>;
    customerId?: string;
    customerName?: string;
    notes?: string;
  }) => {
    try {
      const { sessionId, items, customerId, customerName, notes: _notes } = data;

      if (!sessionId || !items || !Array.isArray(items) || items.length === 0) {
        socket.emit('totem:error', { message: 'INVALID_ORDER_DATA' });
        return;
      }

      // Check if session is closed (bill requested)
      const sessionClosed = await isSessionClosed(sessionId);
      if (sessionClosed) {
        socket.emit('totem:error', { 
          message: 'SESSION_CLOSED',
          details: i18next.t('sockets:SESSION_CLOSED_NO_MORE_ORDERS'),
        });
        return;
      }

      // Verify customer is in the session
      const currentSession = customerSessions.get(socketId);
      if (currentSession !== sessionId) {
        socket.emit('totem:error', { message: 'NOT_IN_SESSION', details: i18next.t('sockets:MUST_JOIN_SESSION') });
        return;
      }

      // Emit to TAS (waiters)
      items.forEach((item) => {
        notifyTASNewOrder(sessionId, {
          item: {
            ...item,
            session_id: sessionId,
            customer_id: customerId,
            customer_name: customerName,
            item_state: 'ORDERED',
            item_disher_type: item.dishType,
            item_name_snapshot: item.dishName,
            item_base_price: item.price,
          },
          customerName: customerName || i18next.t('common:CUSTOMER', { defaultValue: 'Customer' }),
          placedVia: 'totem',
        });
      });

      // Emit to kitchen if there are kitchen items
      const kitchenItems = items.filter(i => i.dishType === 'KITCHEN');
      if (kitchenItems.length > 0) {
        kitchenItems.forEach((item) => {
          notifyKDSNewItem(sessionId, {
            item_dish_id: item.dishId,
            item_name_snapshot: item.dishName,
            item_base_price: item.price,
            item_disher_type: 'KITCHEN',
            item_state: 'ORDERED',
            session_id: sessionId,
            customer_id: customerId,
            customer_name: customerName,
            quantity: item.quantity,
            variant: item.variantId ? {
              variant_id: item.variantId,
              name: item.variantName,
            } : null,
            extras: item.extras || [],
            placedAt: new Date().toISOString(),
            placedBy: 'customer',
          });
        });
      }

      // Get customer info for attribution
      const customerInfoData = customerInfo.get(socketId);
      const attributedCustomerName = customerName || customerInfoData?.customerName || i18next.t('common:CUSTOMER', { defaultValue: 'Customer' });
      const attributedCustomerId = customerId || customerInfoData?.customerId;

      // Confirm to the customer who placed the order
      socket.emit('totem:order_placed', {
        success: true,
        sessionId,
        itemCount: items.length,
        customerName: attributedCustomerName,
        customerId: attributedCustomerId,
        timestamp: new Date().toISOString(),
      });

      // Broadcast to ALL customers at the table about the new order
      const orderId = `order-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      emitToCustomers(sessionId, 'order:items_added', {
        items: items.map(item => ({
          ...item,
          orderedBy: attributedCustomerName,
          orderedByCustomerId: attributedCustomerId,
        })),
        addedBy: attributedCustomerName,
        addedByCustomerId: attributedCustomerId,
        timestamp: new Date().toISOString(),
      });

      // Also emit specific event for table order tracking
      emitToCustomers(sessionId, 'totem:table_order_update', {
        type: 'items_added',
        items: items.map(item => ({
          ...item,
          orderedBy: attributedCustomerName,
          orderedByCustomerId: attributedCustomerId,
          orderId,
        })),
        orderedBy: attributedCustomerName,
        orderedByCustomerId: attributedCustomerId,
        totalItemsAtTable: items.length,
        timestamp: new Date().toISOString(),
      });

      logger.info({ socketId, sessionId, itemCount: items.length }, 'Customer placed order');
    } catch (err: any) {
      logger.error({ err, socketId }, 'totem:place_order error');
      socket.emit('totem:error', { message: 'INTERNAL_ERROR', details: err.message });
    }
  }));

  /**
   * Customer adds item to existing order
   */
  socket.on('totem:add_item', rateLimitWrapper(rateLimiter, socket, 'totem:add_item', async (data: {
    sessionId: string;
    orderId: string;
    item: {
      dishId: string;
      dishName: any;
      price: number;
      dishType: 'KITCHEN' | 'SERVICE';
      variantId?: string;
      variantName?: any;
      extras?: Array<{ extraId: string; extraName: any; price: number }>;
    };
    customerId?: string;
    customerName?: string;
  }) => {
    try {
      const { sessionId, item, customerId, customerName } = data;

      // Check if session is closed (bill requested)
      const sessionClosed = await isSessionClosed(sessionId);
      if (sessionClosed) {
        socket.emit('totem:error', { 
          message: 'SESSION_CLOSED',
          details: i18next.t('sockets:SESSION_CLOSED_NO_MORE_ORDERS'),
        });
        return;
      }

      // Verify customer is in the session
      const currentSession = customerSessions.get(socketId);
      if (currentSession !== sessionId) {
        socket.emit('totem:error', { message: 'NOT_IN_SESSION' });
        return;
      }

      const itemData = {
        ...item,
        session_id: sessionId,
        customer_id: customerId,
        customer_name: customerName,
        item_state: 'ORDERED',
        item_disher_type: item.dishType,
        item_name_snapshot: item.dishName,
        item_base_price: item.price,
        addedAt: new Date().toISOString(),
      };

      // Notify TAS
      notifyTASNewOrder(sessionId, {
        item: itemData,
        customerName: customerName || i18next.t('common:CUSTOMER', { defaultValue: 'Customer' }),
        placedVia: 'totem',
      });

      // Notify kitchen if kitchen item
      if (item.dishType === 'KITCHEN') {
        notifyKDSNewItem(sessionId, itemData);
      }

      socket.emit('totem:item_added', {
        success: true,
        sessionId,
        timestamp: new Date().toISOString(),
      });

      logger.info({ socketId, sessionId, dishId: item.dishId }, 'Customer added item');
    } catch (err: any) {
      logger.error({ err, socketId }, 'totem:add_item error');
      socket.emit('totem:error', { message: 'INTERNAL_ERROR', details: err.message });
    }
  }));

  // ==================== CUSTOMER SERVICE ====================

  /**
   * Customer requests help/waiter
   */
  socket.on('totem:call_waiter', rateLimitWrapper(rateLimiter, socket, 'totem:call_waiter', (data: {
    sessionId: string;
    customerName?: string;
    customerId?: string;
    tableId?: string;
    message?: string;
  }) => {
    try {
      const { sessionId, customerName, customerId, tableId, message } = data;

      const currentSession = customerSessions.get(socketId);
      if (currentSession !== sessionId) {
        socket.emit('totem:error', { message: 'NOT_IN_SESSION' });
        return;
      }

      const helpRequest = {
        sessionId,
        customerId,
        customerName: customerName || i18next.t('common:CUSTOMER', { defaultValue: 'Customer' }),
        tableId,
        message: message || i18next.t('sockets:NEEDS_HELP'),
        timestamp: new Date().toISOString(),
      };

      // Notify TAS
      notifyTASHelpRequest(sessionId, helpRequest);

      // Also emit directly to TAS room
      io.to(`tas:session:${sessionId}`).emit('tas:help_requested', helpRequest);

      // Confirm to customer
      socket.emit('totem:help_request_sent', {
        success: true,
        message: i18next.t('sockets:WAITER_COMING'),
        timestamp: new Date().toISOString(),
      });

      logger.info({ socketId, sessionId, customerName }, 'Customer requested help');
    } catch (err: any) {
      logger.error({ err, socketId }, 'totem:call_waiter error');
      socket.emit('totem:error', { message: 'INTERNAL_ERROR', details: err.message });
    }
  }));

  /**
   * Customer requests the bill
   */
  socket.on('totem:request_bill', rateLimitWrapper(rateLimiter, socket, 'totem:request_bill', async (data: {
    sessionId: string;
    customerName?: string;
    customerId?: string;
    splitType?: 'ALL' | 'BY_USER' | 'SHARED';
  }) => {
    try {
      const { sessionId, customerName, customerId, splitType } = data;

      const currentSession = customerSessions.get(socketId);
      if (currentSession !== sessionId) {
        socket.emit('totem:error', { message: 'NOT_IN_SESSION' });
        return;
      }

      // Check if session is already closed
      const sessionClosed = await isSessionClosed(sessionId);
      if (sessionClosed) {
        socket.emit('totem:error', { 
          message: 'SESSION_ALREADY_CLOSED',
          details: i18next.t('sockets:BILL_ALREADY_REQUESTED'),
        });
        return;
      }

      const billRequest = {
        sessionId,
        customerId,
        customerName: customerName || i18next.t('common:CUSTOMER', { defaultValue: 'Customer' }),
        splitType: splitType || 'ALL',
        requestedBy: 'customer',
        timestamp: new Date().toISOString(),
      };

      // Notify TAS
      notifyTASBillRequest(sessionId, billRequest);

      // Also emit directly
      io.to(`tas:session:${sessionId}`).emit('tas:customer_bill_request', billRequest);
      io.to(`pos:session:${sessionId}`).emit('pos:customer_bill_request', billRequest);

      // Confirm to customer
      socket.emit('totem:bill_request_sent', {
        success: true,
        message: i18next.t('sockets:BILL_REQUEST_SENT'),
        timestamp: new Date().toISOString(),
      });

      // Close session for all customers
      await closeSessionForCustomers(sessionId, {
        closedBy: 'customer',
        closedByName: customerName || i18next.t('common:CUSTOMER', { defaultValue: 'Customer' }),
        reason: i18next.t('sockets:BILL_REQUESTED_BY_CUSTOMER'),
      });

      logger.info({ socketId, sessionId, customerName }, 'Customer requested bill - session closed');
    } catch (err: any) {
      logger.error({ err, socketId }, 'totem:request_bill error');
      socket.emit('totem:error', { message: 'INTERNAL_ERROR', details: err.message });
    }
  }));

  // ==================== REAL-TIME UPDATES ====================

  /**
   * Customer subscribes to item updates for their session
   */
  socket.on('totem:subscribe_items', rateLimitWrapper(rateLimiter, socket, 'totem:subscribe_items', (data: {
    sessionId: string;
  }) => {
    try {
      const { sessionId } = data;
      
      const currentSession = customerSessions.get(socketId);
      if (currentSession !== sessionId) {
        socket.emit('totem:error', { message: 'NOT_IN_SESSION' });
        return;
      }

      // Join the general session room for item updates
      socket.join(`session:${sessionId}`);
      
      socket.emit('totem:items_subscribed', { sessionId });
      logger.info({ socketId, sessionId }, 'Customer subscribed to item updates');
    } catch (err: any) {
      logger.error({ err, socketId }, 'totem:subscribe_items error');
      socket.emit('totem:error', { message: 'INTERNAL_ERROR', details: err.message });
    }
  }));

  /**
   * Get table info - who's at the table and current orders
   */
  socket.on('totem:get_table_info', rateLimitWrapper(rateLimiter, socket, 'totem:get_table_info', (data: {
    sessionId: string;
  }) => {
    try {
      const { sessionId } = data;
      
      const currentSession = customerSessions.get(socketId);
      if (currentSession !== sessionId) {
        socket.emit('totem:error', { message: 'NOT_IN_SESSION' });
        return;
      }

      // Get all customers at this table
      const customersAtTable = getSessionCustomers(sessionId).map(c => ({
        customerId: c.customerId,
        customerName: c.customerName,
        joinedAt: c.joinedAt,
      }));

      // Get this customer's info
      const myInfo = customerInfo.get(socketId);

      socket.emit('totem:table_info', {
        sessionId,
        customersAtTable,
        totalCustomers: customersAtTable.length,
        myCustomerId: myInfo?.customerId,
        myCustomerName: myInfo?.customerName,
        timestamp: new Date().toISOString(),
      });

      logger.info({ socketId, sessionId, customerCount: customersAtTable.length }, 'Table info sent');
    } catch (err: any) {
      logger.error({ err, socketId }, 'totem:get_table_info error');
      socket.emit('totem:error', { message: 'INTERNAL_ERROR', details: err.message });
    }
  }));

  /**
   * Get my orders - orders placed by this specific customer
   */
  socket.on('totem:get_my_orders', rateLimitWrapper(rateLimiter, socket, 'totem:get_my_orders', (data: {
    sessionId: string;
  }) => {
    try {
      const { sessionId } = data;
      
      const currentSession = customerSessions.get(socketId);
      if (currentSession !== sessionId) {
        socket.emit('totem:error', { message: 'NOT_IN_SESSION' });
        return;
      }

      const myInfo = customerInfo.get(socketId);
      if (!myInfo) {
        socket.emit('totem:error', { message: 'CUSTOMER_NOT_FOUND' });
        return;
      }

      // This would typically query the database
      // For now, we acknowledge the request
      socket.emit('totem:my_orders_request', {
        sessionId,
        customerId: myInfo.customerId,
        customerName: myInfo.customerName,
        // Actual orders would be fetched and sent here
        timestamp: new Date().toISOString(),
      });

      logger.info({ socketId, sessionId, customerId: myInfo.customerId }, 'My orders requested');
    } catch (err: any) {
      logger.error({ err, socketId }, 'totem:get_my_orders error');
      socket.emit('totem:error', { message: 'INTERNAL_ERROR', details: err.message });
    }
  }));

  // ==================== DISCONNECT ====================

  socket.on('disconnect', () => {
    try {
      const sessionId = customerSessions.get(socketId);
      const info = customerInfo.get(socketId);
      
      if (sessionId) {
        // Remove from tracking
        const set = sessionCustomers.get(sessionId);
        if (set) {
          set.delete(socketId);
          if (set.size === 0) {
            sessionCustomers.delete(sessionId);
          }
        }
        customerSessions.delete(socketId);
        customerInfo.delete(socketId);

        logger.info({ socketId, sessionId, customerName: info?.customerName }, 'Customer disconnected');

        // Notify other customers at the table
        if (info) {
          emitToCustomers(sessionId, 'totem:customer_left_table', {
            sessionId,
            customerId: info.customerId,
            customerName: info.customerName,
            leftAt: new Date().toISOString(),
          });
        }

        // Notify TAS that customer left
        io.to(`tas:session:${sessionId}`).emit('tas:customer_left', {
          sessionId,
          customerId: info?.customerId,
          customerName: info?.customerName,
          remainingCustomers: sessionCustomers.get(sessionId)?.size || 0,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      logger.error({ err, socketId }, 'Error handling customer disconnect');
    }
  });
}

// ==================== EXPORTED HELPERS ====================

/**
 * Emit event to all customers in a session
 */
export function emitToCustomers(sessionId: string, event: string, data: any): void {
  try {
    const io = getIO();
    io.to(`customer:session:${sessionId}`).emit(event, data);
    logger.debug({ sessionId, event }, 'Emitted event to customers');
  } catch (err) {
    logger.error({ err, sessionId, event }, 'Failed to emit event to customers');
  }
}

/**
 * Notify customers when their item state changes
 */
export function notifyCustomerItemUpdate(sessionId: string, itemId: string, newState: string, itemName?: any): void {
  emitToCustomers(sessionId, 'order:item_update', {
    itemId,
    newState,
    itemName,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Notify customers when waiter sends a message
 */
export function notifyCustomerFromWaiter(sessionId: string, message: string, from: string, type: 'info' | 'warning' | 'success' = 'info'): void {
  emitToCustomers(sessionId, 'notification:from_waiter', {
    message,
    from,
    type,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get active customer count for a session
 */
export function getActiveCustomerCount(sessionId: string): number {
  return sessionCustomers.get(sessionId)?.size || 0;
}

export { customerSessions, sessionCustomers };
