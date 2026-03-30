import { Server } from 'socket.io';
import { logger } from '../config/logger';
import { AuthenticatedSocket } from '../middlewares/socketAuth';
import { createSocketRateLimiter, rateLimitWrapper } from '../middlewares/socketRateLimit';
import { getIO } from '../config/socket';

export function registerPosHandlers(_io: Server, socket: AuthenticatedSocket): void {
  const user = socket.user;
  if (!user) {
    logger.warn({ socketId: socket.id }, 'Unauthorized POS connection attempt');
    socket.disconnect();
    return;
  }

  // Create rate limiter for this socket connection
  const rateLimiter = createSocketRateLimiter();

  socket.on('pos:join', rateLimitWrapper(rateLimiter, socket, 'pos:join', (sessionId: string) => {
    socket.join(`session:${sessionId}`);
    socket.join(`pos:session:${sessionId}`);
    logger.info({ socketId: socket.id, userId: user.staffId, sessionId }, 'POS/TAS joined session room');
  }));

  socket.on('pos:leave', rateLimitWrapper(rateLimiter, socket, 'pos:leave', (sessionId: string) => {
    socket.leave(`session:${sessionId}`);
    socket.leave(`pos:session:${sessionId}`);
    logger.info({ socketId: socket.id, userId: user.staffId, sessionId }, 'POS/TAS left session room');
  }));
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
