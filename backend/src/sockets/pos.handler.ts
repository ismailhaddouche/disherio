import { Server } from 'socket.io';
import { logger } from '../config/logger';
import { AuthenticatedSocket } from '../middlewares/socketAuth';
import { getIO } from '../config/socket';
import { trackSocketConnection, cleanupSocketConnection, trackSocketJoinRoom, trackSocketLeaveRoom, updateSocketActivity } from './middleware/connection-tracker';
import { rateLimitMiddleware, cleanupSocketRateLimits } from './middleware/rate-limiter';
import { validateSessionAccess } from './middleware/session-validator';

export function registerPosHandlers(_io: Server, socket: AuthenticatedSocket): void {
  const user = socket.user;
  
  // Verificar autenticación
  if (!user) {
    logger.warn({ socketId: socket.id }, 'Unauthorized POS connection attempt - no user');
    socket.disconnect();
    return;
  }
  
  // Verificar permiso específico de POS
  if (!user.permissions?.includes('POS')) {
    logger.warn({ 
      socketId: socket.id, 
      userId: user.staffId,
      permissions: user.permissions 
    }, 'Unauthorized POS connection attempt - missing POS permission');
    socket.disconnect();
    return;
  }

  // Track this connection
  trackSocketConnection(socket, 'POS', { userId: user.staffId });

  socket.on('pos:join', rateLimitMiddleware(socket, 'pos:join', async (sessionId: string) => {
    if (!sessionId || typeof sessionId !== 'string') {
      socket.emit('pos:error', { message: 'INVALID_SESSION_ID' });
      return;
    }

    // Validar acceso a la sesión
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

      // Clean up rate limit tracking
      cleanupSocketRateLimits(socket.id).catch(() => {});

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
export function emitSessionClosed(sessionId: string, closedBy?: string): void {
  try {
    const io = getIO();
    
    const eventData = {
      sessionId,
      closedBy,
      timestamp: new Date().toISOString(),
    };

    // Notify POS
    io.to(`pos:session:${sessionId}`).emit('pos:session_closed', eventData);
    
    // Notify TAS
    io.to(`tas:session:${sessionId}`).emit('tas:session_closed', eventData);
    
    // Generic notification
    io.to(`session:${sessionId}`).emit('session:closed', eventData);
    
    logger.info({ sessionId, closedBy }, 'Session closed notification emitted');
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to emit session closed');
  }
}

/**
 * Notify POS and TAS about payment/paid status
 */
export function emitSessionPaid(sessionId: string, paymentData: {
  paymentTotal: number;
  paymentType: 'ALL' | 'BY_USER' | 'SHARED';
  paidBy?: string;
  paidByName?: string;
  tickets?: any[];
}): void {
  try {
    const io = getIO();
    
    const eventData = {
      sessionId,
      ...paymentData,
      timestamp: new Date().toISOString(),
    };

    // Notify POS
    io.to(`pos:session:${sessionId}`).emit('pos:session_paid', eventData);
    
    // Notify TAS
    io.to(`tas:session:${sessionId}`).emit('tas:session_paid', eventData);
    
    // Generic notification
    io.to(`session:${sessionId}`).emit('session:paid', eventData);
    
    logger.info({ sessionId, paymentTotal: paymentData.paymentTotal }, 'Session paid notification emitted');
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to emit session paid');
  }
}

/**
 * Notify POS and TAS when all tickets are paid (session fully paid)
 */
export function emitSessionFullyPaid(sessionId: string, data: {
  paymentTotal: number;
  paymentType: 'ALL' | 'BY_USER' | 'SHARED';
  closedBy?: string;
  closedByName?: string;
}): void {
  try {
    const io = getIO();
    
    const eventData = {
      sessionId,
      ...data,
      timestamp: new Date().toISOString(),
    };

    // Notify POS
    io.to(`pos:session:${sessionId}`).emit('pos:session_fully_paid', eventData);
    
    // Notify TAS
    io.to(`tas:session:${sessionId}`).emit('tas:session_fully_paid', {
      ...eventData,
      message: 'Session fully paid and closed',
    });
    
    // Generic notification
    io.to(`session:${sessionId}`).emit('session:fully_paid', eventData);
    
    logger.info({ sessionId, paymentTotal: data.paymentTotal }, 'Session fully paid notification emitted');
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to emit session fully paid');
  }
}

/**
 * Notify POS when a customer places a new order via totem/socket
 */
export function notifyPOSNewOrder(sessionId: string, orderData: any): void {
  try {
    const io = getIO();
    io.to(`pos:session:${sessionId}`).emit('pos:new_customer_order', {
      ...orderData,
      timestamp: new Date().toISOString(),
    });
    logger.debug({ sessionId }, 'Emitted pos:new_customer_order to POS');
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to emit pos:new_customer_order');
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
