import { Server } from 'socket.io';
import i18next from 'i18next';
import mongoose from 'mongoose';

import { logger } from '../config/logger';
import { AuthenticatedSocket } from '../middlewares/socketAuth';
import { getIO } from '../config/socket';
import { notifyTASNewOrder, notifyTASHelpRequest, notifyTASBillRequest } from './tas.handler';
import { notifyKDSNewItem } from './kds.handler';
import { notifyPOSNewOrder } from './pos.handler';
import { TotemSessionRepository } from '../repositories';
import { trackSocketConnection, cleanupSocketConnection, trackSocketJoinRoom, trackSocketLeaveRoom, updateSocketActivity } from './middleware/connection-tracker';
import { rateLimitMiddleware, cleanupSocketRateLimits } from './middleware/rate-limiter';

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

// Track sessions in the process of closing (to prevent race conditions)
const closingSessions = new Set<string>();

// Track active session close timeouts for cleanup
const sessionCloseTimeouts = new Map<string, NodeJS.Timeout>(); // sessionId -> timeoutId

// Helper function to check if session is closing
export function isSessionClosing(sessionId: string): boolean {
  return closingSessions.has(sessionId);
}

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

// Track last activity time for cleanup
const sessionLastActivity = new Map<string, number>(); // sessionId -> timestamp
const customerLastActivity = new Map<string, number>(); // socketId -> timestamp

// Configuration for cleanup
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
const CUSTOMER_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Run cleanup every hour

// Get all customers in a session
function getSessionCustomers(sessionId: string): Array<{ customerId?: string; customerName: string; socketId: string; joinedAt: string }> {
  const socketIds = sessionCustomers.get(sessionId);
  if (!socketIds) return [];
  
  return Array.from(socketIds)
    .map(socketId => customerInfo.get(socketId))
    .filter((info): info is NonNullable<typeof info> => info !== undefined);
}

// Cleanup stale entries periodically
function cleanupStaleEntries(): void {
  const now = Date.now();
  let cleanedSessions = 0;
  let cleanedCustomers = 0;

  // Clean up stale sessions
  for (const [sessionId, lastActivity] of sessionLastActivity.entries()) {
    if (now - lastActivity > SESSION_TIMEOUT_MS) {
      // Clean up session-related data
      sessionCustomers.delete(sessionId);
      closingSessions.delete(sessionId);
      
      // Clear any pending timeout
      const timeoutId = sessionCloseTimeouts.get(sessionId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        sessionCloseTimeouts.delete(sessionId);
      }
      
      sessionLastActivity.delete(sessionId);
      cleanedSessions++;
    }
  }

  // Clean up stale customer entries
  for (const [socketId, lastActivity] of customerLastActivity.entries()) {
    if (now - lastActivity > CUSTOMER_TIMEOUT_MS) {
      customerSessions.delete(socketId);
      customerInfo.delete(socketId);
      customerLastActivity.delete(socketId);
      cleanedCustomers++;
    }
  }

  if (cleanedSessions > 0 || cleanedCustomers > 0) {
    logger.info(
      { cleanedSessions, cleanedCustomers },
      'Cleaned up stale socket tracking entries'
    );
  }
}

// Start periodic cleanup
const cleanupInterval = setInterval(cleanupStaleEntries, CLEANUP_INTERVAL_MS);

// Ensure cleanup interval is cleared on process exit (for tests)
process.once('exit', () => clearInterval(cleanupInterval));

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
    
    // Marcar sesión como cerrándose INMEDIATAMENTE (prevenir race condition)
    closingSessions.add(sessionId);
    
    // Update last activity
    sessionLastActivity.set(sessionId, Date.now());
    
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

    // Clear any existing timeout for this session
    const existingTimeout = sessionCloseTimeouts.get(sessionId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      sessionCloseTimeouts.delete(sessionId);
    }

    // Force disconnect all customers from the room after a short delay
    const timeoutId = setTimeout(() => {
      try {
        // Verificar que la sesión siga existiendo en nuestro tracking
        if (!sessionCustomers.has(sessionId)) {
          closingSessions.delete(sessionId);
          sessionCloseTimeouts.delete(sessionId);
          return;
        }
        
        const socketIds = sessionCustomers.get(sessionId);
        if (socketIds) {
          socketIds.forEach(socketId => {
            // Verificar que el socket siga existente antes de operar
            const socket = io.sockets.sockets.get(socketId);
            if (socket && socket.connected) {
              try {
                socket.leave(`customer:session:${sessionId}`);
                socket.emit('totem:force_disconnect', {
                  reason: 'SESSION_CLOSED',
                  message: i18next.t('sockets:SESSION_ENDED_THANK_YOU'),
                });
              } catch (socketErr) {
                logger.warn({ err: socketErr, socketId, sessionId }, 'Error disconnecting socket');
              }
            }
          });
          
          // Clear tracking for this session
          sessionCustomers.delete(sessionId);
        }
        
        // Limpiar el Set cuando termine
        closingSessions.delete(sessionId);
        sessionCloseTimeouts.delete(sessionId);
        sessionLastActivity.delete(sessionId);
        
        logger.info({ sessionId }, 'Session close timeout completed, all customers disconnected');
      } catch (timeoutErr) {
        logger.error({ err: timeoutErr, sessionId }, 'Error in session close timeout');
        closingSessions.delete(sessionId);
        sessionCloseTimeouts.delete(sessionId);
      }
    }, 5000); // Give 5 seconds for clients to show the message

    // Store timeout reference for cleanup
    sessionCloseTimeouts.set(sessionId, timeoutId);

    logger.info({ sessionId, closedBy: data.closedBy }, 'Session closed for customers');
  } catch (err) {
    // Limpiar en caso de error también
    closingSessions.delete(sessionId);
    const timeoutId = sessionCloseTimeouts.get(sessionId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      sessionCloseTimeouts.delete(sessionId);
    }
    logger.error({ err, sessionId }, 'Failed to close session for customers');
  }
}

// Reopen session (if needed, e.g., bill cancelled) - updates database
export async function reopenSession(sessionId: string): Promise<void> {
  try {
    // Clear any pending close timeout
    const timeoutId = sessionCloseTimeouts.get(sessionId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      sessionCloseTimeouts.delete(sessionId);
    }
    
    // Remove from closing sessions
    closingSessions.delete(sessionId);
    
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
  
  // Track this connection
  trackSocketConnection(socket, 'TOTEM');

  logger.info({ socketId }, 'Customer/Totem client connected');

  // ==================== SESSION MANAGEMENT ====================

  /**
   * Customer joins a session room (after scanning QR)
   * Payload: { sessionId: string, customerName?: string }
   */
  socket.on('totem:join_session', rateLimitMiddleware(socket, 'totem:join_session', async (data: {
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

      // Validar formato de sessionId
      if (!mongoose.Types.ObjectId.isValid(sessionId)) {
        socket.emit('totem:error', { message: 'INVALID_SESSION_ID_FORMAT' });
        return;
      }

      // Check if session is already closed or in process of closing
      const sessionClosed = await isSessionClosed(sessionId);
      const sessionClosing = isSessionClosing(sessionId);

      if (sessionClosed || sessionClosing) {
        socket.emit('totem:error', { 
          message: 'SESSION_CLOSED',
          details: sessionClosing 
            ? i18next.t('sockets:SESSION_CLOSING_IN_PROGRESS')
            : i18next.t('sockets:SESSION_CLOSED_NO_MORE_ORDERS'),
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
      
      // Track room join in connection tracker
      trackSocketJoinRoom(socketId, roomName);
      updateSocketActivity(socketId);

      // Update activity timestamps
      const now = Date.now();
      customerLastActivity.set(socketId, now);
      sessionLastActivity.set(sessionId, now);

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
  socket.on('totem:leave_session', rateLimitMiddleware(socket, 'totem:leave_session', () => {
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
        customerInfo.delete(socketId);
        customerLastActivity.delete(socketId);
        
        // Track room leave in connection tracker
        trackSocketLeaveRoom(socketId, `customer:session:${sessionId}`);
        updateSocketActivity(socketId);
        
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
  socket.on('totem:place_order', rateLimitMiddleware(socket, 'totem:place_order', async (data: {
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

      // Update activity timestamps
      customerLastActivity.set(socketId, Date.now());
      sessionLastActivity.set(sessionId, Date.now());

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

      // Notify POS about new order
      notifyPOSNewOrder(sessionId, {
        items: items.map(item => ({
          item_dish_id: item.dishId,
          item_name_snapshot: item.dishName,
          item_base_price: item.price,
          item_disher_type: item.dishType,
          item_state: 'ORDERED',
          session_id: sessionId,
          customer_id: customerId,
          customer_name: customerName,
          quantity: item.quantity,
        })),
        addedBy: 'customer',
        customerName,
        customerId,
        placedVia: 'totem',
      });

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
  socket.on('totem:add_item', rateLimitMiddleware(socket, 'totem:add_item', async (data: {
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

      // Update activity timestamps
      customerLastActivity.set(socketId, Date.now());
      sessionLastActivity.set(sessionId, Date.now());

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
  socket.on('totem:call_waiter', rateLimitMiddleware(socket, 'totem:call_waiter', (data: {
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

      // Update activity timestamps
      customerLastActivity.set(socketId, Date.now());
      sessionLastActivity.set(sessionId, Date.now());

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
  socket.on('totem:request_bill', rateLimitMiddleware(socket, 'totem:request_bill', async (data: {
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

      // Update activity timestamps
      customerLastActivity.set(socketId, Date.now());
      sessionLastActivity.set(sessionId, Date.now());

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
  socket.on('totem:subscribe_items', rateLimitMiddleware(socket, 'totem:subscribe_items', (data: {
    sessionId: string;
  }) => {
    try {
      const { sessionId } = data;
      
      const currentSession = customerSessions.get(socketId);
      if (currentSession !== sessionId) {
        socket.emit('totem:error', { message: 'NOT_IN_SESSION' });
        return;
      }

      // Update activity timestamps
      customerLastActivity.set(socketId, Date.now());
      sessionLastActivity.set(sessionId, Date.now());

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
  socket.on('totem:get_table_info', rateLimitMiddleware(socket, 'totem:get_table_info', (data: {
    sessionId: string;
  }) => {
    try {
      const { sessionId } = data;
      
      const currentSession = customerSessions.get(socketId);
      if (currentSession !== sessionId) {
        socket.emit('totem:error', { message: 'NOT_IN_SESSION' });
        return;
      }

      // Update activity timestamps
      customerLastActivity.set(socketId, Date.now());
      sessionLastActivity.set(sessionId, Date.now());

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
  socket.on('totem:get_my_orders', rateLimitMiddleware(socket, 'totem:get_my_orders', (data: {
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

      // Update activity timestamps
      customerLastActivity.set(socketId, Date.now());

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
            
            // Si no hay más clientes en la sesión, limpiar el timeout de cierre si existe
            const timeoutId = sessionCloseTimeouts.get(sessionId);
            if (timeoutId) {
              clearTimeout(timeoutId);
              sessionCloseTimeouts.delete(sessionId);
              closingSessions.delete(sessionId);
              logger.info({ sessionId }, 'Cleared session close timeout - no more customers');
            }
          }
        }
        customerSessions.delete(socketId);
        customerInfo.delete(socketId);
        customerLastActivity.delete(socketId);

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

      // Remove all listeners registered by this socket to prevent memory leaks
      socket.removeAllListeners();

      // Clean up connection tracking
      cleanupSocketConnection(socketId);

      // Clean up rate limit tracking
      cleanupSocketRateLimits(socketId).catch(() => {});

      logger.info({ socketId }, 'Totem client disconnected and cleaned up');
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
