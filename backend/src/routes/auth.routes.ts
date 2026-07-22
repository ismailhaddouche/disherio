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
// Refresh uses the general API limiter, not the login limiter: it continues
// an existing session with a high-entropy opaque token, so it is not a
// credential-guessing surface. Keeping it under the 5-failures/15-min login
// bucket let one device with a corrupt cookie block every login behind the
// same NAT IP.
router.post('/refresh', apiLimiter, refresh);
router.post('/logout', apiLimiter, logout);

export default router;
