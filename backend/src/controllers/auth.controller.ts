import { Request, Response } from 'express';
import { asyncHandler, createError } from '../utils/async-handler';
import { ErrorCode } from '@disherio/shared';
import { parseDurationToMs } from '../utils/duration';
import {
  loginWithUsername,
  loginWithPin,
  buildPayloadById,
} from '../services/auth.service';
import { Restaurant } from '../models/restaurant.model';
import {
  rotateRefreshToken,
  blocklistAccessToken,
  revokeRefreshFamily,
  verifyRefreshToken,
  isAccessTokenRevoked,
  generateAccessToken,
} from '../services/refresh-token.service';
import { disconnectStaffSockets } from '../services/socket-session.service';

const ACCESS_COOKIE = 'auth_token';
const REFRESH_COOKIE = 'refresh_token';

function isSecureRequest(req: Request): boolean {
  // A request is secure if it arrived over TLS directly or via a trusted
  // proxy that forwarded it over HTTPS. This must NOT be based on NODE_ENV
  // alone because a production deployment accessed over plain HTTP (e.g. a
  // bare IP without a domain/TLS) would set Secure cookies that the browser
  // silently discards, breaking authentication entirely.
  if (req.secure) return true;
  // Only honor X-Forwarded-Proto when the app trusts the reverse proxy.
  // Without trust proxy, any client can spoof this header and force Secure
  // cookies, so it must be ignored.
  const trustProxy = req.app?.get('trust proxy');
  if (!trustProxy) return false;
  const xfp = req.headers['x-forwarded-proto'];
  if (typeof xfp === 'string') {
    return xfp.split(',')[0].trim().toLowerCase() === 'https';
  }
  return false;
}

function cookieOptions(maxAge: number, isSecure: boolean): { [key: string]: unknown } {
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    maxAge,
    path: '/',
  };
}

function setAccessCookie(res: Response, token: string, isSecure: boolean): void {
  const maxAge = parseDurationToMs(process.env.JWT_EXPIRES || '15m');
  res.cookie(ACCESS_COOKIE, token, cookieOptions(maxAge, isSecure));
}

function accessTokenExpiresInMs(): number {
  return parseDurationToMs(process.env.JWT_EXPIRES || '15m');
}

function setRefreshCookie(res: Response, token: string, isSecure: boolean): void {
  const maxAge = parseDurationToMs(process.env.JWT_REFRESH_EXPIRES || '7d');
  res.cookie(REFRESH_COOKIE, token, cookieOptions(maxAge, isSecure));
}

function extractRefreshToken(req: Request): string | null {
  return req.cookies?.refresh_token ?? null;
}

function extractAccessToken(req: Request): string | null {
  if (req.cookies?.auth_token) return req.cookies.auth_token;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

export const loginUsername = asyncHandler(async (req: Request, res: Response) => {
  const { username, password, restaurant_id } = req.body;
  const { accessToken, refreshToken, user } = await loginWithUsername(
    username,
    password,
    restaurant_id
  );
  const isSecure = isSecureRequest(req);
  setAccessCookie(res, accessToken, isSecure);
  setRefreshCookie(res, refreshToken, isSecure);
  res.json({
    user,
    expires_in_ms: accessTokenExpiresInMs(),
  });
});

export const loginPin = asyncHandler(async (req: Request, res: Response) => {
  const { pin_code, restaurant_id } = req.body;
  const { accessToken, refreshToken, user } = await loginWithPin(
    pin_code,
    restaurant_id,
    req.ip
  );
  const isSecure = isSecureRequest(req);
  setAccessCookie(res, accessToken, isSecure);
  setRefreshCookie(res, refreshToken, isSecure);
  res.json({
    user,
    expires_in_ms: accessTokenExpiresInMs(),
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = extractRefreshToken(req);
  if (!refreshToken) {
    throw createError.unauthorized(ErrorCode.INVALID_TOKEN);
  }

  const rotation = await rotateRefreshToken(refreshToken);
  if (!rotation) {
    throw createError.unauthorized(ErrorCode.INVALID_TOKEN);
  }

  const freshPayload = await buildPayloadById(rotation.userId);
  if (!freshPayload) {
    await revokeRefreshFamily(rotation.family);
    throw createError.unauthorized(ErrorCode.UNAUTHORIZED);
  }

  const newAccessToken = generateAccessToken(freshPayload);

  const isSecure = isSecureRequest(req);
  setAccessCookie(res, newAccessToken, isSecure);
  setRefreshCookie(res, rotation.refreshToken, isSecure);

  // Fetch the restaurant so the refresh response includes the current
  // enabled_languages set (matching the login response shape).
  const restaurant = await Restaurant.findById(freshPayload.restaurantId).lean();
  const { authVersion: _authVersion, ...publicPayload } = freshPayload;
  res.json({
    user: {
      ...publicPayload,
      enabled_languages: restaurant?.enabled_languages ?? ['es', 'en', 'fr'],
    },
    expires_in_ms: accessTokenExpiresInMs(),
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const isSecure = isSecureRequest(req);
  let staffId = req.user?.staffId;

  try {
    const accessToken = extractAccessToken(req);
    if (accessToken && !(await isAccessTokenRevoked(accessToken))) {
      await blocklistAccessToken(accessToken);
    }

    // Revoke only the current refresh token family instead of every session,
    // so logging out one device does not kill the user's other devices.
    // The logout route has no auth middleware, so without a refresh cookie
    // there is no identity to revoke further tokens for.
    const refreshToken = extractRefreshToken(req);
    if (refreshToken) {
      const verification = await verifyRefreshToken(refreshToken);
      if (verification.valid && verification.family) {
        staffId = verification.payload?.staffId ?? staffId;
        await revokeRefreshFamily(verification.family);
      }
    }
  } finally {
    if (staffId) {
      await disconnectStaffSockets(staffId);
    }
    res.clearCookie(ACCESS_COOKIE, cookieOptions(0, isSecure));
    res.clearCookie(REFRESH_COOKIE, cookieOptions(0, isSecure));
  }

  res.json({ message: 'LOGOUT_SUCCESS' });
});
