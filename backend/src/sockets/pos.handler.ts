import { Server } from 'socket.io';
import type { SessionArchivedEvent, SessionClosedEvent, SessionReopenedEvent } from '@disherio/shared';
import { logger } from '../config/logger';
import { AuthenticatedSocket } from '../middlewares/socketAuth';
import { getIO } from '../config/socket';
import { trackSocketConnection, cleanupSocketConnection, trackSocketJoinRoom, trackSocketLeaveRoom, updateSocketActivity } from './middleware/connection-tracker';
import { rateLimitMiddleware } from './middleware/rate-limiter';
import { validateSessionAccess } from './middleware/session-validator';

export function registerPosHandlers(_io: Server, socket: AuthenticatedSocket): void {
  const user = socket.user;

  // Verify authentication
  if (!user) {
    logger.debug({ socketId: socket.id }, 'Skipping POS handler registration for anonymous socket');
    return;
  }

  // Verify specific POS permission
  if (!user.permissions?.includes('POS')) {
    logger.debug({
      socketId: socket.id,
      userId: user.staffId,
      permissions: user.permissions
    }, 'Skipping POS handler registration - missing POS permission');
    return;
  }

  // Track this connection
  trackSocketConnection(socket, 'POS', { userId: user.staffId });
  const restaurantRoom = `pos:restaurant:${user.restaurantId}`;
  socket.join(restaurantRoom);
  trackSocketJoinRoom(socket.id, restaurantRoom);

  socket.on('pos:join', rateLimitMiddleware(socket, 'pos:join', async (sessionId: string) => {
    if (!sessionId || typeof sessionId !== 'string') {
      socket.emit('pos:error', { message: 'INVALID_SESSION_ID' });
      return;
    }

    // Validate session access
    const validation = await validateSessionAccess(socket, sessionId);
    if (!validation.allowed) {
      socket.emit('pos:error', {
        message: validation.reason || 'UNAUTHORIZED'
      });
      return;
    }

    socket.join(`session:${sessionId}`);
    socket.join(`pos:session:${sessionId}`);

    // Track room joins
    trackSocketJoinRoom(socket.id, `session:${sessionId}`);
    trackSocketJoinRoom(socket.id, `pos:session:${sessionId}`);
    updateSocketActivity(socket.id);

    logger.info({ socketId: socket.id, userId: user.staffId, sessionId }, 'POS/TAS joined session room');
  }));

  socket.on('pos:leave', rateLimitMiddleware(socket, 'pos:leave', (sessionId: string) => {
    socket.leave(`session:${sessionId}`);
    socket.leave(`pos:session:${sessionId}`);

    // Track room leaves
    trackSocketLeaveRoom(socket.id, `session:${sessionId}`);
    trackSocketLeaveRoom(socket.id, `pos:session:${sessionId}`);
    updateSocketActivity(socket.id);

    logger.info({ socketId: socket.id, userId: user.staffId, sessionId }, 'POS/TAS left session room');
  }));

  // ==================== DISCONNECT ====================
  // IMPORTANT: Cleanup on disconnect to prevent memory leaks

  socket.on('disconnect', () => {
    try {
      // Remove all listeners registered by this socket to prevent memory leaks
      socket.removeAllListeners();

      // Clean up connection tracking
      cleanupSocketConnection(socket.id);


      logger.info({ socketId: socket.id, userId: user.staffId }, 'POS client disconnected and cleaned up');
    } catch (err) {
      logger.error({ err, socketId: socket.id, userId: user.staffId }, 'Error during POS disconnect cleanup');
    }
  });
}

// ==================== EXPORTED HELPERS ====================

/**
 * Notify POS and TAS about session closure
 */
export function emitSessionClosed(
  sessionId: string,
  state: SessionClosedEvent['state'],
  closedBy?: string,
  restaurantId?: string
): void {
  try {
    const io = getIO();

    const eventData: SessionClosedEvent = {
      sessionId,
      state,
      closedBy,
      timestamp: new Date().toISOString(),
    };

    const posRooms = [`pos:session:${sessionId}`];
    const tasRooms = [`tas:session:${sessionId}`];
    if (restaurantId) {
      posRooms.push(`pos:restaurant:${restaurantId}`);
      tasRooms.push(`tas:restaurant:${restaurantId}`);
    }

    io.to(posRooms).emit('pos:session_closed', eventData);
    io.to(tasRooms).emit('tas:session_closed', eventData);

    logger.info({ sessionId, state, closedBy }, 'Session closed notification emitted');
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to emit session closed');
  }
}

/**
 * Notify POS and TAS that a session has been reopened (STARTED again).
 */
export function emitSessionReopened(sessionId: string, reopenedBy?: string, restaurantId?: string): void {
  try {
    const io = getIO();

    const eventData: SessionReopenedEvent = {
      sessionId,
      reopenedBy,
      timestamp: new Date().toISOString(),
    };

    const posRooms = [`pos:session:${sessionId}`];
    const tasRooms = [`tas:session:${sessionId}`];
    if (restaurantId) {
      posRooms.push(`pos:restaurant:${restaurantId}`);
      tasRooms.push(`tas:restaurant:${restaurantId}`);
    }

    io.to(posRooms).emit('pos:session_reopened', eventData);
    io.to(tasRooms).emit('tas:session_reopened', eventData);
    logger.info({ sessionId, reopenedBy }, 'Session reopened notification emitted');
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to emit session reopened');
  }
}

/**
 * Notify POS and TAS when a paid session is archived.
 */
export function emitSessionArchived(
  sessionId: string,
  data: Omit<SessionArchivedEvent, 'sessionId' | 'timestamp'>,
  restaurantId?: string
): void {
  try {
    const io = getIO();

    const eventData = {
      sessionId,
      ...data,
      timestamp: new Date().toISOString(),
    };

    const posRooms = [`pos:session:${sessionId}`];
    const tasRooms = [`tas:session:${sessionId}`];
    if (restaurantId) {
      posRooms.push(`pos:restaurant:${restaurantId}`);
      tasRooms.push(`tas:restaurant:${restaurantId}`);
    }

    io.to(posRooms).emit('pos:session_archived', eventData);

    // Notify TAS
    io.to(tasRooms).emit('tas:session_archived', eventData);

    logger.info({ sessionId, paymentTotal: data.paymentTotal }, 'Session archived notification emitted');
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to emit session archived');
  }
}

/**
 * Notify POS when a customer places a new order via totem/socket.
 * Emits kds:new_item per item — the event name the POS frontend listens for.
 */
export function notifyPOSNewOrder(sessionId: string, orderData: any): void {
  try {
    const io = getIO();
    const items: any[] = Array.isArray(orderData.items) ? orderData.items : [orderData.items];
    items.forEach((item) => {
      io.to(`pos:session:${sessionId}`).emit('kds:new_item', {
        ...item,
        timestamp: new Date().toISOString(),
      });
    });
    logger.debug({ sessionId, count: items.length }, 'Emitted new items to POS');
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to emit new items to POS');
  }
}

/**
 * Notify about partial payment (ticket paid)
 */
export function emitTicketPaid(sessionId: string, data: {
  ticketPart: number;
  ticketAmount: number;
  paidBy?: string;
  remainingAmount?: number;
}): void {
  try {
    const io = getIO();

    const eventData = {
      sessionId,
      ...data,
      timestamp: new Date().toISOString(),
    };

    // Notify POS
    io.to(`pos:session:${sessionId}`).emit('pos:ticket_paid', eventData);

    // Notify TAS
    io.to(`tas:session:${sessionId}`).emit('tas:ticket_paid', eventData);

    logger.info({ sessionId, ticketPart: data.ticketPart, amount: data.ticketAmount }, 'Ticket paid notification emitted');
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to emit ticket paid');
  }
}
