import { z } from 'zod';

/**
 * Process-env validation. Fails fast when DATABASE_URL is missing/invalid.
 * Does not embed real credentials — see .env.example for placeholders only.
 */
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  PORT: z.coerce.number().int().positive().optional(),
  DATABASE_URL: z
    .string({
      required_error:
        'DATABASE_URL is required (set in repository-root .env; see .env.example placeholders)',
    })
    .min(1, 'DATABASE_URL is required')
    .refine(
      (v) => v.startsWith('postgresql://') || v.startsWith('postgres://'),
      'DATABASE_URL must be a PostgreSQL connection string (postgresql://...)',
    ),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('.local/storage'),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default('auto'),
  MAIL_DRIVER: z.enum(['console', 'file', 'smtp']).default('console'),
  MAIL_FILE_DIR: z.string().default('.local/mail'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  /** Comma-separated browser origins allowed for credentialed CORS + cookie CSRF Origin check. */
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  SESSION_COOKIE_NAME: z.string().default('gc_session'),
  /** Session TTL in hours (default 14 days). */
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24 * 14),
  /** Login rate limit: max attempts per IP per window. */
  AUTH_LOGIN_RATE_LIMIT: z.coerce.number().int().positive().default(10),
  AUTH_LOGIN_RATE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`,
    );
    throw new Error(
      [
        'Invalid environment configuration.',
        'Load only the repository-root .env (see .env.example). Do not rely on parent-directory env files.',
        ...lines,
      ].join('\n'),
    );
  }
  return parsed.data;
}
