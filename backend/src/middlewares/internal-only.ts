import { Request, Response, NextFunction } from 'express';
import { createError } from '../utils/async-handler';
import { ErrorCode } from '@disherio/shared';

const INTERNAL_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
];

function isInternalIp(ip: string): boolean {
  return INTERNAL_IP_RANGES.some((range) => range.test(ip));
}

/**
 * Restricts access to internal endpoints (health, metrics) to requests coming
 * from private networks or presenting a valid internal token header.
 */
export function internalOnly(req: Request, _res: Response, next: NextFunction): void {
  const clientIp = req.ip ?? req.socket.remoteAddress ?? '';
  const internalToken = req.get('x-internal-token');

  // Allow requests from private/Docker networks.
  if (isInternalIp(clientIp)) {
    next();
    return;
  }

  // Allow requests with a valid internal token.
  const expectedToken = process.env.INTERNAL_API_TOKEN;
  if (expectedToken && internalToken === expectedToken) {
    next();
    return;
  }

  next(createError.forbidden(ErrorCode.FORBIDDEN));
}
