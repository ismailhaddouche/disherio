import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { loginWithUsername, loginWithPin } from '../services/auth.service';

const COOKIE_NAME = 'auth_token';
const isProduction = process.env.NODE_ENV === 'production';

function setAuthCookie(res: Response, token: string): void {
  const jwtExpires = process.env.JWT_EXPIRES || '8h';
  const hours = parseInt(jwtExpires) || 8;
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: hours * 60 * 60 * 1000,
    path: '/',
  });
}

export const loginUsername = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;
  const { token, user } = await loginWithUsername(username, password);
  setAuthCookie(res, token);
  res.json({ user });
});

export const loginPin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { pin_code, restaurant_id } = req.body;
  const { token, user } = await loginWithPin(pin_code, restaurant_id);
  setAuthCookie(res, token);
  res.json({ user });
});

export const logout = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ message: 'Logged out' });
});
