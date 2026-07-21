/**
 * Connection Tracker Middleware for Socket.IO
 *
 * Provides global socket connection tracking and cleanup to prevent memory leaks.
 * Tracks active connections and ensures proper cleanup on disconnect.
 */

import { Server, Socket } from 'socket.io';
import { logger } from '../../config/logger';
import type { AuthenticatedSocket } from '../../middlewares/socketAuth';

// Connection metadata interface
interface ConnectionMetadata {
  socketId: string;
  userId?: string;
  userType: 'authenticated' | 'anonymous';
  permissions: string[];
  connectedAt: Date;
  lastActivity: Date;
  namespaces: string[];
  rooms: Set<string>;
  clientInfo?: {
    ip?: string;
    userAgent?: string;
  };
}

// Global maps to track connections
const activeConnections = new Map<string, ConnectionMetadata>();
const connectionsByUser = new Map<string, Set<string>>(); // userId -> socketIds
const connectionsByType = new Map<string, Set<string>>(); // handlerType -> socketIds

/**
 * Initialize connection tracking for a socket
 * Call this from each handler's registration function
 */
export function trackSocketConnection(
  socket: Socket,
  handlerType: string,
  metadata?: Partial<ConnectionMetadata>
): void {
  // Sockets are registered as AuthenticatedSocket by every handler; the base
  // Socket type is kept in the signature so the tracker also accepts plain sockets.
  // The `id` fallback covers user payloads that expose the id as `id` instead of `staffId`.
  const user = (socket as AuthenticatedSocket).user as (AuthenticatedSocket['user'] & { id?: string });
  const socketId = socket.id;

  const connectionMeta: ConnectionMetadata = {
    socketId,
    userId: user?.staffId || user?.id,
    userType: user ? 'authenticated' : 'anonymous',
    permissions: user?.permissions || [],
    connectedAt: new Date(),
    lastActivity: new Date(),
    namespaces: [handlerType],
    rooms: new Set(),
    clientInfo: {
      ip: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent'],
    },
    ...metadata,
  };

  // Store in active connections
  activeConnections.set(socketId, connectionMeta);

  // Track by user ID if authenticated
  if (connectionMeta.userId) {
    if (!connectionsByUser.has(connectionMeta.userId)) {
      connectionsByUser.set(connectionMeta.userId, new Set());
    }
    connectionsByUser.get(connectionMeta.userId)!.add(socketId);
  }

  // Track by handler type
  if (!connectionsByType.has(handlerType)) {
    connectionsByType.set(handlerType, new Set());
  }
  connectionsByType.get(handlerType)!.add(socketId);

  logger.debug({
    socketId,
    handlerType,
    userId: connectionMeta.userId,
    totalConnections: activeConnections.size,
  }, 'Socket connection tracked');
}

/**
 * Update socket activity timestamp
 */
export function updateSocketActivity(socketId: string): void {
  const meta = activeConnections.get(socketId);
  if (meta) {
    meta.lastActivity = new Date();
  }
}

/**
 * Track when socket joins a room
 */
export function trackSocketJoinRoom(socketId: string, room: string): void {
  const meta = activeConnections.get(socketId);
  if (meta) {
    meta.rooms.add(room);
  }
}

/**
 * Track when socket leaves a room
 */
export function trackSocketLeaveRoom(socketId: string, room: string): void {
  const meta = activeConnections.get(socketId);
  if (meta) {
    meta.rooms.delete(room);
  }
}

/**
 * Cleanup socket connection tracking
 * Call this from disconnect handlers
 */
export function cleanupSocketConnection(socketId: string): void {
  const meta = activeConnections.get(socketId);

  if (!meta) {
    return;
  }

  // Remove from user tracking
  if (meta.userId) {
    const userConnections = connectionsByUser.get(meta.userId);
    if (userConnections) {
      userConnections.delete(socketId);
      if (userConnections.size === 0) {
        connectionsByUser.delete(meta.userId);
      }
    }
  }

  // Remove from type tracking
  for (const handlerType of meta.namespaces) {
    const typeConnections = connectionsByType.get(handlerType);
    if (typeConnections) {
      typeConnections.delete(socketId);
      if (typeConnections.size === 0) {
        connectionsByType.delete(handlerType);
      }
    }
  }

  // Remove from active connections
  activeConnections.delete(socketId);

  logger.debug({
    socketId,
    userId: meta.userId,
    duration: Date.now() - meta.connectedAt.getTime(),
    totalConnections: activeConnections.size,
  }, 'Socket connection cleaned up');
}

/**
 * Register global disconnect cleanup
 * This ensures cleanup happens even if individual handlers forget
 */
export function registerGlobalDisconnectHandler(io: Server): void {
  io.on('connection', (socket: Socket) => {
    // Register a one-time disconnect listener for global cleanup
    socket.once('disconnect', (reason: string) => {
      try {
        // Clean up tracking
        cleanupSocketConnection(socket.id);

        // Force remove all listeners as a safety net
        socket.removeAllListeners();

        // Leave all rooms
        for (const room of socket.rooms) {
          if (room !== socket.id) {
            socket.leave(room);
          }
        }

        logger.debug({ socketId: socket.id, reason }, 'Global disconnect cleanup executed');
      } catch (err) {
        logger.error({ err, socketId: socket.id }, 'Error in global disconnect cleanup');
      }
    });
  });
}

// Export types for external use
export { ConnectionMetadata };
