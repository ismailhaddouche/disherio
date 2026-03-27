import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JwtPayload } from './auth';

export interface AuthenticatedSocket extends Socket {
  user?: JwtPayload;
}

function extractSocketToken(socket: AuthenticatedSocket): string | undefined {
  // Prefer HttpOnly cookie (sent automatically with withCredentials: true)
  const cookieHeader = socket.handshake.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  // Fallback: explicit auth.token (non-browser clients)
  return socket.handshake.auth?.token as string | undefined;
}

export function socketAuthMiddleware(socket: AuthenticatedSocket, next: (err?: Error) => void): void {
  const token = extractSocketToken(socket);

  if (!token) {
    return next(new Error('AUTHENTICATION_REQUIRED'));
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return next(new Error('SERVER_CONFIGURATION_ERROR'));
  }

  try {
    const payload = jwt.verify(token, jwtSecret) as JwtPayload;
    socket.user = payload;
    next();
  } catch {
    next(new Error('INVALID_TOKEN'));
  }
}
