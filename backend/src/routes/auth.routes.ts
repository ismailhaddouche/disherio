import { Router } from 'express';
import {
  loginUsername,
  loginPin,
  logout,
  refresh,
} from '../controllers/auth.controller';
import { validate } from '../middlewares/validate';
import { LoginSchema, PinSchema } from '../schemas/auth.schema';
import { apiLimiter, authLimiter } from '../middlewares/rateLimit';

const router = Router();

router.post('/login', authLimiter, validate(LoginSchema), loginUsername);
router.post('/pin', authLimiter, validate(PinSchema), loginPin);
router.post('/refresh', authLimiter, refresh);
router.post('/logout', apiLimiter, logout);

export default router;
