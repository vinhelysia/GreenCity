import { z } from 'zod';

/**
 * Process-env validation. Fails fast with clear messages when PostgreSQL URL
 * is missing or clearly unusable.
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
        'DATABASE_URL is required (e.g. postgresql://greencity:greencity@localhost:5432/greencity?schema=public)',
    })
    .min(1, 'DATABASE_URL is required')
    .refine(
      (v) => v.startsWith('postgresql://') || v.startsWith('postgres://'),
      'DATABASE_URL must be a PostgreSQL connection string (postgresql://...)',
    ),
  /** local | s3 — Phase 0 default: local filesystem */
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('.local/storage'),
  /** Future S3-compatible (unused when STORAGE_DRIVER=local) */
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default('auto'),
  /** console | file | smtp — Phase 0 default: console */
  MAIL_DRIVER: z.enum(['console', 'file', 'smtp']).default('console'),
  MAIL_FILE_DIR: z.string().default('.local/mail'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
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
        'Invalid environment configuration. Fix .env (see .env.example).',
        ...lines,
      ].join('\n'),
    );
  }
  return parsed.data;
}
