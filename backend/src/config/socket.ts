import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { ErrorCode } from '@disherio/shared';
import { logger } from './logger';
import { registerKdsHandlers } from '../sockets/kds.handler';
import { registerPosHandlers } from '../sockets/pos.handler';
import { registerTasHandlers } from '../sockets/tas.handler';
import { registerTotemHandlers } from '../sockets/totem.handler';
import { socketAuthMiddleware, AuthenticatedSocket } from '../middlewares/socketAuth';
import { registerGlobalDisconnectHandler } from '../sockets/middleware/connection-tracker';
import { initSocketRedisAdapter } from './redis';

let io: SocketServer | undefined;

// Build allowed origins for Socket.IO
function getAllowedOrigins(): string[] {
  const origins: string[] = [];

  if (process.env.FRONTEND_URL) {
    const frontendUrl = process.env.FRONTEND_URL;
    origins.push(frontendUrl);

    try {
      const parsed = new URL(frontendUrl);
      // Add variant with default port explicitly (browsers may include/omit it)
      // For http: default port is 80; for https: default port is 443
      const defaultPort = parsed.protocol === 'https:' ? '443' : '80';
      const hostWithoutPort = parsed.hostname;
      if (!parsed.port || parsed.port === defaultPort) {
        // URL has no explicit port or uses the default — add the explicit-port variant
        origins.push(`${parsed.protocol}//${hostWithoutPort}:${defaultPort}`);
        // And the no-port variant (already in origins if no port was given)
        if (parsed.port === defaultPort) {
          origins.push(`${parsed.protocol}//${hostWithoutPort}`);
        }
      }
    } catch {
      // If FRONTEND_URL is not a valid URL, just use it as-is
    }
  } else {
    origins.push('http://localhost:4200');
  }

  return origins;
}

export async function initSocket(httpServer: HttpServer): Promise<SocketServer> {
  const allowedOrigins = getAllowedOrigins();
  logger.info({ allowedOrigins }, 'Socket.IO CORS origins');

  const socketServer = new SocketServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });
  io = socketServer;

  // Setup Redis adapter for multi-node support
  try {
    const { pubClient, subClient } = await initSocketRedisAdapter();
    socketServer.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.IO Redis adapter configured for multi-node support');
  } catch (err) {
    logger.error({ err }, 'Failed to configure Redis adapter, falling back to in-memory adapter');
    // Continue without Redis adapter - will use default in-memory adapter
  }

  // Apply authentication middleware to all connections
  socketServer.use((socket, next) => {
    socketAuthMiddleware(socket as AuthenticatedSocket, next).catch((err) => {
      logger.error({ err }, 'Unexpected error in socket auth middleware');
      next(new Error(ErrorCode.SERVER_CONFIGURATION_ERROR));
    });
  });

  // Register global disconnect handler as safety net for memory leak prevention
  registerGlobalDisconnectHandler(socketServer);
  logger.info('Global disconnect handler registered');

  socketServer.on('connection', (socket: AuthenticatedSocket) => {
    logger.info({ socketId: socket.id, userId: socket.user?.staffId }, 'Client connected');

    const permissions = socket.user?.permissions ?? [];

    if (socket.user) {
      socket.join(`user:${socket.user.staffId}`);
    }

    if (permissions.includes('KTS')) {
      registerKdsHandlers(socketServer, socket);
    }

    if (permissions.includes('POS')) {
      registerPosHandlers(socketServer, socket);
    }

    if (permissions.includes('TAS')) {
      registerTasHandlers(socketServer, socket);
    }

    registerTotemHandlers(socketServer, socket);

    socket.on('disconnect', () => {
      logger.info({ socketId: socket.id, userId: socket.user?.staffId }, 'Client disconnected');
    });
  });

  return socketServer;
}

/**
 * Cleanup function to stop socket server
 * Call this before shutting down the server
 */
export async function cleanupSocketServer(): Promise<void> {
  logger.info('Socket server cleanup initiated');

  if (io) {
    // Socket.IO closes connected clients and the attached HTTP server before
    // invoking this callback.
    await new Promise<void>((resolve) => io!.close(() => resolve()));
    io = undefined;
    logger.info('Socket.IO server closed');
  }
}

export function getIO(): SocketServer {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}
