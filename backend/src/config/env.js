import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must contain at least 32 characters'),
  CLIENT_ORIGIN: z.url().optional(),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
}).superRefine((values, context) => {
  if (values.NODE_ENV === 'production' && !values.MONGODB_URI) {
    context.addIssue({
      code: 'custom',
      path: ['MONGODB_URI'],
      message: 'MONGODB_URI must be configured in production.',
    });
  }
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const summary = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${summary}`);
}

export const config = {
  nodeEnv: parsed.data.NODE_ENV,
  port: parsed.data.PORT,
  mongoUri: parsed.data.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/queuesaathi_demo',
  jwtSecret: parsed.data.JWT_SECRET,
  clientOrigin: parsed.data.CLIENT_ORIGIN,
  cookieSameSite: parsed.data.COOKIE_SAME_SITE,
  isProduction: parsed.data.NODE_ENV === 'production',
};

if (config.cookieSameSite === 'none' && !config.isProduction) {
  // Browsers require Secure when SameSite=None; keep local dev on Lax.
  console.warn('COOKIE_SAME_SITE=none requires HTTPS cookies and is intended for production deployments.');
}
