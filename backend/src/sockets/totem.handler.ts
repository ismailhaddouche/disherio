import { Server } from 'socket.io';
import i18next from 'i18next';

import { logger } from '../config/logger';
import { AuthenticatedSocket } from '../middlewares/socketAuth';
import { getIO } from '../config/socket';
import { notifyTASHelpRequest, notifyTASBillRequest } from './tas.handler';
import { TotemSessionRepository } from '../repositories';
import { ItemOrderRepository } from '../repositories/order.repository';
import { trackSocketConnection, cleanupSocketConnection, trackSocketJoinRoom, trackSocketLeaveRoom, updateSocketActivity } from './middleware/connection-tracker';
import { bindSocketRateLimitToCustomer, rateLimitMiddleware } from './middleware/rate-limiter';
import { validateSocketPayload } from './middleware/validate-payload';
import * as TotemService from '../services/totem.service';
import type {
  LocalizedField,
  TotemCallWaiterPayload,
  TotemJoinSessionPayload,
  TotemRequestBillPayload,
  TotemSessionIdPayload,
} from '@disherio/shared';
import {
  TotemJoinSessionPayloadSchema,
  TotemRequestBillPayloadSchema,
  TotemCallWaiterPayloadSchema,
  TotemSessionIdPayloadSchema,
} from '@disherio/shared';

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
const MAX_SESSION_CLOSE_SET = 500;
const closingSessions = new Set<string>();

// Track active session close timeouts for cleanup
const MAX_TIMEOUT_MAP = 500;
const sessionCloseTimeouts = new Map<string, NodeJS.Timeout>(); // sessionId -> timeoutId

// Helper function to check if session is closing
export function isSessionClosing(sessionId: string): boolean {
  return closingSessions.has(sessionId);
}

// Repository instance
const totemSessionRepo = new TotemSessionRepository();
const itemOrderRepo = new ItemOrderRepository();

// Track active customer sessions (WebSocket connections only)
const MAX_MAP_SIZE = 2000;
const customerSessions = new Map<string, string>(); // socketId -> sessionId
const sessionCustomers = new Map<string, Set<string>>(); // sessionId -> Set of socketIds
const customerInfo = new Map<string, {
  customerId?: string;
  customerName: string;
  socketId: string;
  joinedAt: string;
  sessionToken?: string;
}>(); // socketId -> customer info

// Track last activity time for cleanup
const sessionLastActivity = new Map<string, number>(); // sessionId -> timestamp
const customerLastActivity = new Map<string, number>(); // socketId -> timestamp

// Configuration for cleanup
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
const CUSTOMER_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 hours
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // Run cleanup every 10 minutes (was 1h)

// Enforce maximum size on a Map by evicting oldest entries
function enforceMapSize<K, V>(map: Map<K, V>, max: number): void {
  if (map.size > max) {
    const entriesToDelete = map.size - max;
    let deleted = 0;
    for (const key of map.keys()) {
      if (deleted >= entriesToDelete) break;
      map.delete(key);
      deleted++;
    }
  }
}

// Get all customers in a session
function getSessionCustomers(sessionId: string): Array<{ customerId?: string; customerName: string; socketId: string; joinedAt: string }> {
  const socketIds = sessionCustomers.get(sessionId);
  if (!socketIds) return [];

  return Array.from(socketIds)
    .map(socketId => customerInfo.get(socketId))
    .filter((info): info is NonNullable<typeof info> => info !== undefined);
}

/**
 * Verify that the socket is bound to the given session and that the session
 * token it presented at join time still matches the one stored on the session.
 * Returns true when the socket may operate on the session, false otherwise
 * (an error is emitted to the socket in the failure case).
 */
async function assertSocketBoundToSession(
  socket: AuthenticatedSocket,
  socketId: string,
  sessionId: string
): Promise<boolean> {
  // Authenticated staff sockets must not act as totem customers.
  if (socket.user) {
    socket.emit('totem:error', { message: 'FORBIDDEN' });
    return false;
  }
  const boundSession = customerSessions.get(socketId);
  if (boundSession !== sessionId) {
    socket.emit('totem:error', { message: 'NOT_IN_SESSION' });
    return false;
  }
  const info = customerInfo.get(socketId);
  if (!info || !info.sessionToken) {
    socket.emit('totem:error', { message: 'NOT_IN_SESSION' });
    return false;
  }
  // Re-validate the token against the current DB state so a rotated or
  // invalidated token is rejected even for long-lived sockets.
  try {
    const session = await totemSessionRepo.findById(sessionId);
    if (!session || session.totem_state !== 'STARTED') {
      socket.emit('totem:error', { message: 'SESSION_CLOSED' });
      return false;
    }
    if (!session.session_token || session.session_token !== info.sessionToken) {
      socket.emit('totem:error', { message: 'INVALID_TOKEN' });
      return false;
    }
  } catch (err) {
    logger.error({ err, socketId, sessionId }, 'Failed to re-validate session token');
    socket.emit('totem:error', { message: 'INTERNAL_ERROR' });
    return false;
  }
  return true;
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

  // Enforce maximum map sizes
  enforceMapSize(customerSessions, MAX_MAP_SIZE);
  enforceMapSize(customerInfo, MAX_MAP_SIZE);
  enforceMapSize(sessionLastActivity, MAX_MAP_SIZE);
  enforceMapSize(customerLastActivity, MAX_MAP_SIZE);
  enforceMapSize(sessionCloseTimeouts, MAX_TIMEOUT_MAP);
  if (closingSessions.size > MAX_SESSION_CLOSE_SET) {
    closingSessions.clear();
  }
}

// Start periodic cleanup
const cleanupInterval = setInterval(cleanupStaleEntries, CLEANUP_INTERVAL_MS);
cleanupInterval.unref();

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

// Close an active session when needed, then notify and detach all customers.
export async function closeSessionForCustomers(sessionId: string, data: {
  closedBy: 'customer' | 'waiter' | 'pos' | 'system';
  closedByName?: string;
  totalAmount?: number;
  reason?: string;
  stateAlreadyTransitioned?: boolean;
}): Promise<boolean> {
  try {
    const io = getIO();

    // Mark session as closing IMMEDIATELY (prevent race condition)
    closingSessions.add(sessionId);

    // Update last activity
    sessionLastActivity.set(sessionId, Date.now());

    // Atomically transition STARTED -> COMPLETE. If the session is no longer
    // STARTED (another node already closed it), this returns null and we skip
    // emitting duplicate close events.
    if (!data.stateAlreadyTransitioned) {
      const updated = await totemSessionRepo.updateStateIf(sessionId, ['STARTED'], 'COMPLETE');
      if (!updated) {
        closingSessions.delete(sessionId);
        logger.info({ sessionId }, 'Session already closed; skipping duplicate close emission');
        return false;
      }
    }

    // Notify all customers at the table
    io.to(`customer:session:${sessionId}`).emit('totem:session_closed', {
      sessionId,
      closedBy: data.closedBy,
      closedByName: data.closedByName,
      totalAmount: data.totalAmount,
      reason: data.reason || i18next.t('sockets.BILL_REQUESTED'),
      message: i18next.t('sockets.SESSION_CLOSED_NO_MORE_ORDERS'),
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
        // Verify session still exists in our tracking
        if (!sessionCustomers.has(sessionId)) {
          closingSessions.delete(sessionId);
          sessionCloseTimeouts.delete(sessionId);
          return;
        }

        const socketIds = sessionCustomers.get(sessionId);
        if (socketIds) {
          socketIds.forEach(socketId => {
            // Verify socket still exists before operating
            const socket = io.sockets.sockets.get(socketId);
            if (socket && socket.connected) {
              try {
                socket.leave(`customer:session:${sessionId}`);
                socket.emit('totem:force_disconnect', {
                  reason: 'SESSION_CLOSED',
                  message: i18next.t('sockets.SESSION_ENDED_THANK_YOU'),
                });
              } catch (socketErr) {
                logger.warn({ err: socketErr, socketId, sessionId }, 'Error disconnecting socket');
              }
            }
          });

          // Clear tracking for this session
          sessionCustomers.delete(sessionId);
        }

        // Clear the Set when done
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
    return true;
  } catch (err) {
    // Clean up on error as well
    closingSessions.delete(sessionId);
    const timeoutId = sessionCloseTimeouts.get(sessionId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      sessionCloseTimeouts.delete(sessionId);
    }
    logger.error({ err, sessionId }, 'Failed to close session for customers');
    return false;
  }
}

/**
 * Cancel the pending force-disconnect scheduled when a session was closed.
 * Must run when a session is reopened: customers who rejoin within the close
 * grace period would otherwise be disconnected by the stale timeout, and
 * isSessionClosing would keep rejecting their joins.
 */
export function cancelPendingSessionClose(sessionId: string): void {
  const timeoutId = sessionCloseTimeouts.get(sessionId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    sessionCloseTimeouts.delete(sessionId);
  }
  closingSessions.delete(sessionId);
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
  socket.on('totem:join_session', rateLimitMiddleware(socket, 'totem:join_session', async (data: TotemJoinSessionPayload) => {
    try {
      const { sessionId, qr, customerName, customerId, sessionToken } = data;

      // Authenticated staff sockets must not act as totem customers.
      if (socket.user) {
        socket.emit('totem:error', { message: 'FORBIDDEN' });
        return;
      }

      if (!validateSocketPayload(socket, 'totem', 'totem:join_session', TotemJoinSessionPayloadSchema, data)) {
        return;
      }

      // Resolve and validate the public session, including the ephemeral
      // session token. The QR alone is no longer sufficient to join a session.
      const session = await TotemService.getPublicSessionByQR(qr, sessionId, sessionToken);
      if (customerId) {
        await TotemService.assertCustomerInSession(customerId, sessionId, sessionToken);
        bindSocketRateLimitToCustomer(socket, customerId);
      }

      // Check if session is already closed or in process of closing
      const sessionClosed = await isSessionClosed(sessionId);
      const sessionClosing = isSessionClosing(sessionId);

      if (sessionClosed || sessionClosing) {
        socket.emit('totem:error', {
          message: 'SESSION_CLOSED',
          details: sessionClosing
            ? i18next.t('sockets.SESSION_CLOSING_IN_PROGRESS')
            : i18next.t('sockets.SESSION_CLOSED_NO_MORE_ORDERS'),
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

      // Store customer info, binding the verified session token to this socket
      // so subsequent events (request_bill, call_waiter, ...) can re-validate it.
      const joinedAt = new Date().toISOString();
      customerInfo.set(socketId, {
        customerId,
        customerName: customerName || i18next.t('common.CUSTOMER', { defaultValue: 'Customer' }),
        socketId,
        joinedAt,
        sessionToken: session.session_token,
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
        customerName: customerName || i18next.t('common.CUSTOMER', { defaultValue: 'Customer' }),
        joinedAt,
      });

      // Notify TAS that a customer joined
      io.to(`tas:session:${sessionId}`).emit('tas:customer_joined', {
        sessionId,
        customerName: customerName || i18next.t('common.CUSTOMER', { defaultValue: 'Customer' }),
        customerId,
        totalCustomersAtTable: sessionCustomers.get(sessionId)?.size || 1,
        timestamp: joinedAt,
      });

    } catch (err: unknown) {
      logger.error({ err, socketId }, 'totem:join_session error');
      socket.emit('totem:error', { message: 'SESSION_ACCESS_DENIED' });
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
    } catch (err: unknown) {
      logger.error({ err, socketId }, 'totem:leave_session error');
      socket.emit('totem:error', { message: 'INTERNAL_ERROR' });
    }
  }));

  // ==================== ORDERS ====================

  // NOTE: Order placement is handled via REST (POST /totems/menu/:qr/order) which persists
  // to the database. Socket-based order placement (totem:place_order, totem:add_item) was
  // removed because it did not persist orders, causing data loss.
  // See PublicOrderService.createPublicOrderFromQR.

  // ==================== CUSTOMER SERVICE ====================

  /**
   * Customer requests help/waiter
   */
  socket.on('totem:call_waiter', rateLimitMiddleware(socket, 'totem:call_waiter', async (data: TotemCallWaiterPayload) => {
    try {
      const { sessionId, tableId, message } = data;

      if (!validateSocketPayload(socket, 'totem', 'totem:call_waiter', TotemCallWaiterPayloadSchema, data)) {
        return;
      }

      if (!(await assertSocketBoundToSession(socket, socketId, sessionId))) {
        return;
      }

      const boundCustomer = customerInfo.get(socketId);
      if (!boundCustomer) {
        socket.emit('totem:error', { message: 'NOT_IN_SESSION' });
        return;
      }

      // Update activity timestamps
      customerLastActivity.set(socketId, Date.now());
      sessionLastActivity.set(sessionId, Date.now());

      const helpRequest = {
        sessionId,
        customerId: boundCustomer.customerId,
        customerName: boundCustomer.customerName,
        tableId,
        message: message || i18next.t('sockets.NEEDS_HELP'),
        timestamp: new Date().toISOString(),
      };

      // Notify TAS (notifyTASHelpRequest emits tas:help_requested to the
      // session's TAS room)
      notifyTASHelpRequest(sessionId, helpRequest);

      // Confirm to customer
      socket.emit('totem:help_request_sent', {
        success: true,
        message: i18next.t('sockets.WAITER_COMING'),
        timestamp: new Date().toISOString(),
      });

      logger.info({ socketId, sessionId, customerId: boundCustomer.customerId }, 'Customer requested help');
    } catch (err: unknown) {
      logger.error({ err, socketId }, 'totem:call_waiter error');
      socket.emit('totem:error', { message: 'INTERNAL_ERROR' });
    }
  }));

  /**
   * Customer requests the bill
   */
  socket.on('totem:request_bill', rateLimitMiddleware(socket, 'totem:request_bill', async (data: TotemRequestBillPayload) => {
    try {
      const { sessionId, splitType } = data;

      if (!validateSocketPayload(socket, 'totem', 'totem:request_bill', TotemRequestBillPayloadSchema, data)) {
        return;
      }

      if (!(await assertSocketBoundToSession(socket, socketId, sessionId))) {
        return;
      }

      const boundCustomer = customerInfo.get(socketId);
      if (!boundCustomer) {
        socket.emit('totem:error', { message: 'NOT_IN_SESSION' });
        return;
      }

      // Check in-memory lock FIRST to avoid DB race condition
      if (isSessionClosing(sessionId)) {
        socket.emit('totem:error', {
          message: 'SESSION_ALREADY_CLOSED',
          details: i18next.t('sockets.BILL_ALREADY_REQUESTED'),
        });
        return;
      }

      // Check if session is already closed in DB
      const sessionClosed = await isSessionClosed(sessionId);
      if (sessionClosed) {
        socket.emit('totem:error', {
          message: 'SESSION_ALREADY_CLOSED',
          details: i18next.t('sockets.BILL_ALREADY_REQUESTED'),
        });
        return;
      }

      // Update activity timestamps
      customerLastActivity.set(socketId, Date.now());
      sessionLastActivity.set(sessionId, Date.now());

      const persisted = await closeSessionForCustomers(sessionId, {
        closedBy: 'customer',
        closedByName: boundCustomer.customerName,
        reason: i18next.t('sockets.BILL_REQUESTED_BY_CUSTOMER'),
      });
      if (!persisted) {
        socket.emit('totem:error', { message: 'SESSION_ALREADY_CLOSED' });
        return;
      }

      const billRequest = {
        sessionId,
        customerId: boundCustomer.customerId,
        customerName: boundCustomer.customerName,
        splitType: splitType || 'ALL',
        requestedBy: 'customer',
        timestamp: new Date().toISOString(),
      };

      // Notify TAS (notifyTASBillRequest emits tas:customer_bill_request to the
      // session's TAS room)
      notifyTASBillRequest(sessionId, billRequest);

      io.to(`pos:session:${sessionId}`).emit('pos:customer_bill_request', billRequest);

      // Confirm to customer
      socket.emit('totem:bill_request_sent', {
        success: true,
        message: i18next.t('sockets.BILL_REQUEST_SENT'),
        timestamp: new Date().toISOString(),
      });

      logger.info({ socketId, sessionId, customerId: boundCustomer.customerId }, 'Customer requested bill - session closed');
    } catch (err: unknown) {
      logger.error({ err, socketId }, 'totem:request_bill error');
      socket.emit('totem:error', { message: 'INTERNAL_ERROR' });
    }
  }));

  // ==================== REAL-TIME UPDATES ====================

  /**
   * Customer subscribes to item updates for their session
   */
  socket.on('totem:subscribe_items', rateLimitMiddleware(socket, 'totem:subscribe_items', async (data: TotemSessionIdPayload) => {
    try {
      const { sessionId } = data;

      if (!validateSocketPayload(socket, 'totem', 'totem:subscribe_items', TotemSessionIdPayloadSchema, data)) {
        return;
      }

      if (!(await assertSocketBoundToSession(socket, socketId, sessionId))) {
        return;
      }

      // Update activity timestamps
      customerLastActivity.set(socketId, Date.now());
      sessionLastActivity.set(sessionId, Date.now());

      // Join the general session room for item updates
      socket.join(`session:${sessionId}`);

      socket.emit('totem:items_subscribed', { sessionId });
      logger.info({ socketId, sessionId }, 'Customer subscribed to item updates');
    } catch (err: unknown) {
      logger.error({ err, socketId }, 'totem:subscribe_items error');
      socket.emit('totem:error', { message: 'INTERNAL_ERROR' });
    }
  }));

  /**
   * Get table info - who's at the table and current orders
   */
  socket.on('totem:get_table_info', rateLimitMiddleware(socket, 'totem:get_table_info', async (data: TotemSessionIdPayload) => {
    try {
      const { sessionId } = data;

      if (!validateSocketPayload(socket, 'totem', 'totem:get_table_info', TotemSessionIdPayloadSchema, data)) {
        return;
      }

      if (!(await assertSocketBoundToSession(socket, socketId, sessionId))) {
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
    } catch (err: unknown) {
      logger.error({ err, socketId }, 'totem:get_table_info error');
      socket.emit('totem:error', { message: 'INTERNAL_ERROR' });
    }
  }));

  /**
   * Get my orders - orders placed by this specific customer
   */
  socket.on('totem:get_my_orders', rateLimitMiddleware(socket, 'totem:get_my_orders', async (data: TotemSessionIdPayload) => {
    try {
      const { sessionId } = data;

      if (!validateSocketPayload(socket, 'totem', 'totem:get_my_orders', TotemSessionIdPayloadSchema, data)) {
        return;
      }

      if (!(await assertSocketBoundToSession(socket, socketId, sessionId))) {
        return;
      }

      const myInfo = customerInfo.get(socketId);
      if (!myInfo?.customerId) {
        socket.emit('totem:error', { message: 'CUSTOMER_NOT_FOUND' });
        return;
      }

      // Update activity timestamps
      customerLastActivity.set(socketId, Date.now());

      const orders = await itemOrderRepo.findByCustomerAndSessionId(myInfo.customerId, sessionId);
      socket.emit('totem:my_orders', {
        sessionId,
        customerId: myInfo.customerId,
        orders,
        totalOrders: orders.length,
        timestamp: new Date().toISOString(),
      });

      logger.info({ socketId, sessionId, customerId: myInfo.customerId }, 'My orders requested');
    } catch (err: unknown) {
      logger.error({ err, socketId }, 'totem:get_my_orders error');
      socket.emit('totem:error', { message: 'INTERNAL_ERROR' });
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

            // If no more customers in session, clear the close timeout if exists
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


      logger.info({ socketId }, 'Totem client disconnected and cleaned up');
    } catch (err: unknown) {
      logger.error({ err, socketId }, 'Error handling customer disconnect');
    }
  });
}

// ==================== EXPORTED HELPERS ====================

/**
 * Emit event to all customers in a session
 */
export function emitToCustomers(sessionId: string, event: string, data: unknown): void {
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
export function notifyCustomerItemUpdate(sessionId: string, itemId: string, newState: string, itemName?: LocalizedField): void {
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

export { customerSessions, sessionCustomers };
