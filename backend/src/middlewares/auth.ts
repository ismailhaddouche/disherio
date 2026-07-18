import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ErrorCode } from '@disherio/shared';
import { logger } from '../config/logger';
import { isAccessTokenRevoked } from '../services/refresh-token.service';
import { getEnv } from '../config/env';
import { isAccessSessionCurrent } from '../services/access-session.service';
import { createError } from '../utils/async-handler';

export interface JwtPayload {
  staffId: string;
  restaurantId: string;
  role: string;
  permissions: string[];
  name: string;
  authVersion?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

function extractToken(req: Request): string | null {
  // Prefer HttpOnly cookie (parsed by cookie-parser)
  if (req.cookies?.auth_token) return req.cookies.auth_token;
  // Fallback: Bearer header (non-browser clients)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  authenticate(req, res, next).catch((err) => {
    logger.error({ err }, 'Unexpected error in auth middleware');
    next(createError.unauthorized(ErrorCode.UNAUTHORIZED));
  });
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    next(createError.unauthorized(ErrorCode.UNAUTHORIZED));
    return;
  }

  const jwtSecret = getEnv().JWT_SECRET;
  if (!jwtSecret) {
    logger.error('JWT_SECRET not configured');
    next(createError.internal(ErrorCode.SERVER_CONFIGURATION_ERROR));
    return;
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;
  } catch {
    next(createError.unauthorized(ErrorCode.INVALID_TOKEN));
    return;
  }

  // Check Redis blocklist for revoked tokens
  if (await isAccessTokenRevoked(token)) {
    next(createError.unauthorized(ErrorCode.INVALID_TOKEN));
    return;
  }

  if (!(await isAccessSessionCurrent(payload))) {
    next(createError.unauthorized(ErrorCode.INVALID_TOKEN));
    return;
  }

  req.user = payload;
  next();
}
