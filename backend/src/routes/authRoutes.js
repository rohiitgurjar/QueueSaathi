import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as controller from '../controllers/authController.js';
import { requireAuth } from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../validators/schemas.js';

const router = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many sign-in attempts. Try again in 15 minutes.' } },
});
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many account creation attempts. Try again later.' } },
});

router.get('/csrf', controller.issueCsrfToken);
router.post('/register', registrationLimiter, validateBody(registerSchema), controller.register);
router.post('/login', authLimiter, validateBody(loginSchema), controller.signIn);
router.get('/me', requireAuth, controller.me);
router.post('/logout', controller.signOut);

export default router;
