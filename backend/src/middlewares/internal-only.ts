import { Request, Response, NextFunction } from 'express';
import { createError } from '../utils/async-handler';
import { ErrorCode } from '@disherio/shared';

const INTERNAL_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^::1$/,
  /^f[cd][0-9a-f]{2}:/i,
  /^fe80:/,
];

// Without trust proxy, req.ip is the direct TCP peer. Behind a reverse proxy
// (Caddy) that peer is always the proxy itself — an internal IP — so the
// private-range check would wave every external request through. In that mode
// only loopback (in-container healthchecks) is provably local; everything
// else must present the internal token.
const LOOPBACK_IP_RANGES = [
  /^127\./,
  /^::1$/,
];

function isInternalIp(ip: string, trustProxy: boolean): boolean {
  const normalizedIp = ip.startsWith('::ffff:') ? ip.slice('::ffff:'.length) : ip;
  const ranges = trustProxy ? INTERNAL_IP_RANGES : LOOPBACK_IP_RANGES;
  return ranges.some((range) => range.test(normalizedIp));
}

/**
 * Restricts access to internal endpoints (health, metrics) to requests coming
 * from private networks or presenting a valid internal token header.
 */
export function internalOnly(req: Request, _res: Response, next: NextFunction): void {
  const clientIp = req.ip ?? req.socket.remoteAddress ?? '';
  const internalToken = req.get('x-internal-token');
  const trustProxy = process.env.TRUST_PROXY === 'true';

  // Allow requests from private/Docker networks.
  if (isInternalIp(clientIp, trustProxy)) {
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
