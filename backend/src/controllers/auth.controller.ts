import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { loginWithEmail, loginWithPin } from '../services/auth.service';
import { createError } from '../utils/async-handler';

export const loginEmail = asyncHandler(async (req: Request, res: Response): Promise<void => {
  const { email, password } = req.body;
  const result = await loginWithEmail(email, password);
  res.json(result);
});

export const loginPin = asyncHandler(async (req: Request, res: Response): Promise<void => {
  const { pin_code, restaurant_id } = req.body;
  const result = await loginWithPin(pin_code, restaurant_id);
  res.json(result);
});
