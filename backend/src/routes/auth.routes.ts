import { Router } from 'express';
import { loginUsername, loginPin, logout } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate';
import { LoginSchema, PinSchema } from '../schemas/auth.schema';
import { authLimiter } from '../middlewares/rateLimit';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.post('/login', authLimiter, validate(LoginSchema), loginUsername);
router.post('/pin', authLimiter, validate(PinSchema), loginPin);
router.post('/logout', authLimiter, authMiddleware, logout);

export default router;
