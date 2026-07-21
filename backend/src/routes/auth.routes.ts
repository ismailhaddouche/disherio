import { Router } from 'express';
import {
  loginUsername,
  logout,
  refresh,
} from '../controllers/auth.controller';
import { validate } from '../middlewares/validate';
import { LoginSchema } from '../schemas/auth.schema';
import { apiLimiter, authLimiter } from '../middlewares/rateLimit';

const router = Router();

router.post('/login', authLimiter, validate(LoginSchema), loginUsername);
router.post('/refresh', authLimiter, refresh);
router.post('/logout', apiLimiter, logout);

export default router;
