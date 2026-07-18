import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ErrorCode } from '@disherio/shared';
import { JwtPayload } from './auth';
import { isAccessTokenRevoked } from '../services/refresh-token.service';
import * as TotemService from '../services/totem.service';
import { logger } from '../config/logger';
import { getEnv } from '../config/env';
import { isAccessSessionCurrent } from '../services/access-session.service';

export interface AuthenticatedSocket extends Socket {
  user?: JwtPayload;
}

interface PublicTotemHandshake {
  publicTotem?: unknown;
  qr?: unknown;
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

export async function socketAuthMiddleware(
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
): Promise<void> {
  // Public totem/customer connections opt out of staff JWT auth. Unlike a bare
  // boolean flag (which any client could set to bypass token checks), a public
  // connection must present a valid totem QR token at handshake time. The
  // session-scoped session_token is still re-validated on every totem event by
  // the join handler (totem.handler.ts) and assertSocketBoundToSession.
  const handshake = socket.handshake.auth as PublicTotemHandshake | undefined;
  if (handshake?.publicTotem === true) {
    const qr = typeof handshake.qr === 'string' ? handshake.qr.trim() : '';
    if (!qr) {
      return next(new Error(ErrorCode.AUTHENTICATION_REQUIRED));
    }
    try {
      const totem = await TotemService.getTotemByQR(qr);
      if (!totem) {
        return next(new Error(ErrorCode.TOTEM_NOT_FOUND));
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to validate public totem QR at handshake');
      return next(new Error(ErrorCode.AUTHENTICATION_REQUIRED));
    }
    socket.user = undefined;
    socket.data.publicTotem = true;
    socket.data.totemQr = qr;
    return next();
  }

  const token = extractSocketToken(socket);

  if (!token) {
    return next(new Error(ErrorCode.AUTHENTICATION_REQUIRED));
  }

  const jwtSecret = getEnv().JWT_SECRET;
  if (!jwtSecret) {
    return next(new Error(ErrorCode.SERVER_CONFIGURATION_ERROR));
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;
  } catch {
    return next(new Error(ErrorCode.INVALID_TOKEN));
  }

  // Check Redis blocklist for revoked tokens
  if (await isAccessTokenRevoked(token)) {
    return next(new Error(ErrorCode.INVALID_TOKEN));
  }

  if (!(await isAccessSessionCurrent(payload))) {
    return next(new Error(ErrorCode.INVALID_TOKEN));
  }

  socket.user = payload;
  next();
}
