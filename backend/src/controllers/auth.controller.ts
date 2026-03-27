import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { loginWithUsername, loginWithPin } from '../services/auth.service';

const COOKIE_NAME = 'auth_token';

function setAuthCookie(res: Response, token: string, isSecure: boolean): void {
  const jwtExpires = process.env.JWT_EXPIRES || '8h';
  const maxAge = parseDurationToMs(jwtExpires);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,  // Solo true si es HTTPS
    sameSite: isSecure ? 'strict' : 'lax',  // lax para HTTP, strict para HTTPS
    maxAge: maxAge,
    path: '/',
  });
}

/**
 * Parse duration string to milliseconds
 * Supports: h (hours), d (days), m (minutes), s (seconds)
 * Default: 8 hours if parsing fails
 */
function parseDurationToMs(duration: string): number {
  const match = duration.match(/^(\d+)([hHdDmMsS])?$/);
  if (!match) return 8 * 60 * 60 * 1000; // Default 8 hours
  
  const value = parseInt(match[1], 10);
  const unit = (match[2] || 'h').toLowerCase();
  
  const multipliers: Record<string, number> = {
    's': 1000,        // seconds
    'm': 60 * 1000,   // minutes
    'h': 60 * 60 * 1000,  // hours
    'd': 24 * 60 * 60 * 1000,  // days
  };
  
  return value * (multipliers[unit] || multipliers['h']);
}

// Detect if request is HTTPS (works behind reverse proxy)
function isSecureRequest(req: Request): boolean {
  // Check for forwarded proto header (from reverse proxy)
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (forwardedProto === 'https') return true;
  
  // Check if direct connection is secure
  return req.secure === true;
}

export const loginUsername = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;
  const { token, user } = await loginWithUsername(username, password);
  setAuthCookie(res, token, isSecureRequest(req));
  res.json({ user });
});

export const loginPin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { pin_code, restaurant_id } = req.body;
  const { token, user } = await loginWithPin(pin_code, restaurant_id);
  setAuthCookie(res, token, isSecureRequest(req));
  res.json({ user });
});

export const logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const isSecure = isSecureRequest(req);
  res.clearCookie(COOKIE_NAME, { 
    path: '/',
    secure: isSecure,
    sameSite: isSecure ? 'strict' : 'lax',
  });
  res.json({ message: 'Logged out' });
});
