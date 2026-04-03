import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { logger } from './logger';
import { registerKdsHandlers } from '../sockets/kds.handler';
import { registerPosHandlers } from '../sockets/pos.handler';
import { registerTasHandlers } from '../sockets/tas.handler';
import { registerTotemHandlers } from '../sockets/totem.handler';
import { socketAuthMiddleware, AuthenticatedSocket } from '../middlewares/socketAuth';
import { registerGlobalDisconnectHandler } from '../sockets/middleware/connection-tracker';
import { initSocketRedisAdapter } from './redis';

let io: SocketServer;

// Build allowed origins for Socket.IO
function getAllowedOrigins(): string[] {
  const origins: string[] = [];
  
  if (process.env.FRONTEND_URL) {
    const frontendUrl = process.env.FRONTEND_URL;
    origins.push(frontendUrl);
    
    // Also add variant without :80 port
    if (frontendUrl.includes(':80')) {
      origins.push(frontendUrl.replace(':80', ''));
    }
    // Also add variant with :80 port
    const urlWithoutPort = frontendUrl.replace(/:\d+$/, '');
    origins.push(`${urlWithoutPort}:80`);
  } else {
    origins.push('http://localhost:4200');
  }
  
  return origins;
}

export async function initSocket(httpServer: HttpServer): Promise<SocketServer> {
  const allowedOrigins = getAllowedOrigins();
  logger.info({ allowedOrigins }, 'Socket.IO CORS origins');
  
  io = new SocketServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Setup Redis adapter for multi-node support
  try {
    const { pubClient, subClient } = await initSocketRedisAdapter();
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.IO Redis adapter configured for multi-node support');
  } catch (err) {
    logger.error({ err }, 'Failed to configure Redis adapter, falling back to in-memory adapter');
    // Continue without Redis adapter - will use default in-memory adapter
  }

  // Apply authentication middleware to all connections
  io.use(socketAuthMiddleware);

  // Register global disconnect handler as safety net for memory leak prevention
  registerGlobalDisconnectHandler(io);
  logger.info('Global disconnect handler registered');

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info({ socketId: socket.id, userId: socket.user?.staffId }, 'Client connected');

    registerKdsHandlers(io, socket);
    registerPosHandlers(io, socket);
    registerTasHandlers(io, socket);
    registerTotemHandlers(io, socket);

    socket.on('disconnect', () => {
      logger.info({ socketId: socket.id, userId: socket.user?.staffId }, 'Client disconnected');
    });
  });

  return io;
}

/**
 * Cleanup function to stop socket server
 * Call this before shutting down the server
 */
export async function cleanupSocketServer(): Promise<void> {
  logger.info('Socket server cleanup initiated');
  
  if (io) {
    // Close all socket connections
    const sockets = await io.fetchSockets();
    await Promise.all(sockets.map(socket => socket.disconnect(true)));
    
    // Close the Socket.IO server
    io.close();
    logger.info('Socket.IO server closed');
  }
}

export function getIO(): SocketServer {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}
