import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { loginWithUsername, loginWithPin } from '../services/auth.service';

const COOKIE_NAME = 'auth_token';
const isProduction = process.env.NODE_ENV === 'production';

function setAuthCookie(res: Response, token: string, isSecure: boolean): void {
  const jwtExpires = process.env.JWT_EXPIRES || '8h';
  const hours = parseInt(jwtExpires) || 8;
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,  // Solo true si es HTTPS
    sameSite: isSecure ? 'strict' : 'lax',  // lax para HTTP, strict para HTTPS
    maxAge: hours * 60 * 60 * 1000,
    path: '/',
  });
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
