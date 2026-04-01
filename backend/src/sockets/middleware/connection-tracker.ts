/**
 * Connection Tracker Middleware for Socket.IO
 * 
 * Provides global socket connection tracking and cleanup to prevent memory leaks.
 * Tracks active connections and ensures proper cleanup on disconnect.
 */

import { Server, Socket } from 'socket.io';
import { logger } from '../../config/logger';

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
  const user = (socket as any).user;
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

// ==================== STATS & MONITORING ====================

/**
 * Get count of active connections
 */
export function getActiveConnectionsCount(): number {
  return activeConnections.size;
}

/**
 * Get detailed connection statistics
 */
export function getConnectionStats(): {
  totalConnections: number;
  authenticatedConnections: number;
  anonymousConnections: number;
  connectionsByType: Record<string, number>;
  connectionsByUser: number;
  averageConnectionDuration: number;
} {
  const now = Date.now();
  let totalDuration = 0;
  let authenticatedCount = 0;
  let anonymousCount = 0;

  for (const meta of activeConnections.values()) {
    totalDuration += now - meta.connectedAt.getTime();
    if (meta.userType === 'authenticated') {
      authenticatedCount++;
    } else {
      anonymousCount++;
    }
  }

  const connectionsByTypeStats: Record<string, number> = {};
  for (const [type, sockets] of connectionsByType.entries()) {
    connectionsByTypeStats[type] = sockets.size;
  }

  return {
    totalConnections: activeConnections.size,
    authenticatedConnections: authenticatedCount,
    anonymousConnections: anonymousCount,
    connectionsByType: connectionsByTypeStats,
    connectionsByUser: connectionsByUser.size,
    averageConnectionDuration: activeConnections.size > 0 
      ? totalDuration / activeConnections.size 
      : 0,
  };
}

/**
 * Get active connections for a specific user
 */
export function getUserConnections(userId: string): string[] {
  const connections = connectionsByUser.get(userId);
  return connections ? Array.from(connections) : [];
}

/**
 * Get connection metadata
 */
export function getConnectionMetadata(socketId: string): ConnectionMetadata | undefined {
  return activeConnections.get(socketId);
}

/**
 * Force disconnect all sockets for a user
 */
export function disconnectUserSockets(userId: string, _reason?: string): number {
  const socketIds = connectionsByUser.get(userId);
  if (!socketIds) return 0;

  let disconnected = 0;
  for (const socketId of socketIds) {
    const meta = activeConnections.get(socketId);
    if (meta) {
      // Note: We can't directly disconnect from here without io reference
      // This would need to be handled by the caller with io.sockets.sockets.get(socketId)
      disconnected++;
    }
  }
  return disconnected;
}

/**
 * Debug helper: Get all tracked connection IDs
 */
export function getAllTrackedSocketIds(): string[] {
  return Array.from(activeConnections.keys());
}

/**
 * Health check - detect potential memory leak indicators
 */
export function checkMemoryHealth(): {
  healthy: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const stats = getConnectionStats();

  // Check for high connection count
  if (stats.totalConnections > 1000) {
    warnings.push(`High connection count: ${stats.totalConnections}`);
  }

  // Check for long-lived connections (potential leak)
  const now = Date.now();
  const oldConnections: string[] = [];
  for (const [socketId, meta] of activeConnections.entries()) {
    const duration = now - meta.connectedAt.getTime();
    if (duration > 24 * 60 * 60 * 1000) { // 24 hours
      oldConnections.push(socketId);
    }
  }
  if (oldConnections.length > 10) {
    warnings.push(`Found ${oldConnections.length} connections older than 24 hours`);
  }

  // Check for connections without rooms (orphaned)
  const orphanedConnections: string[] = [];
  for (const [socketId, meta] of activeConnections.entries()) {
    if (meta.rooms.size === 0 && meta.namespaces.length === 0) {
      orphanedConnections.push(socketId);
    }
  }
  if (orphanedConnections.length > 0) {
    warnings.push(`Found ${orphanedConnections.length} potentially orphaned connections`);
  }

  return {
    healthy: warnings.length === 0,
    warnings,
  };
}

// Export types for external use
export { ConnectionMetadata };
