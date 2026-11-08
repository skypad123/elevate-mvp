import { resolve } from 'node:path'
import { z } from 'zod'

const bool = z.preprocess(
  (v) => (typeof v === 'string' ? ['1', 'true', 'yes', 'on'].includes(v.toLowerCase()) : v),
  z.boolean(),
)

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).optional(),
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(4400),
  API_URL: z.string().url().default('http://localhost:4400'),
  LEARNER_URL: z.string().url().default('http://localhost:8081'),
  TEACH_URL: z.string().url().default('http://localhost:5173'),
  SUPPORT_URL: z.string().url().default('http://localhost:5174'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters'),
  DEV_ENDPOINTS_ENABLED: bool.default(false),
  SEED_SUPER_ADMIN_EMAIL: z.string().email().optional(),

  MAIL_DRIVER: z.enum(['console', 'smtp', 'resend']).default('console'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default('Elevate <hello@elevate.local>'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('.data/storage'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default('auto'),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(),

  VIDEO_DRIVER: z.enum(['local', 'mux']).default('local'),
  MUX_TOKEN_ID: z.string().optional(),
  MUX_TOKEN_SECRET: z.string().optional(),
  MUX_WEBHOOK_SECRET: z.string().optional(),
  MUX_SIGNING_KEY: z.string().optional(),
  MUX_PRIVATE_KEY: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_CONNECT_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_FEE_BPS: z.coerce.number().int().min(0).max(10000).default(340),
  STRIPE_FEE_FIXED_CENTS: z.coerce.number().int().min(0).default(50),
  PLATFORM_CURRENCY: z.string().length(3).default('sgd'),
  DEFAULT_COMMISSION_BPS: z.coerce.number().int().min(0).max(10000).default(1500),
})

export type Env = z.infer<typeof envSchema> & {
  /** Absolute path for the local storage driver. */
  storageLocalDir: string
  repoRoot: string
  isProd: boolean
  isTest: boolean
}

/** apps/api/src → repo root (same depth when bundled to apps/api/dist). */
export const repoRoot = resolve(import.meta.dirname, '../../..')

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, v]) => v !== undefined && v !== ''),
  )
  const parsed = envSchema.safeParse(cleaned)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid environment:\n${issues}`)
  }
  const env = parsed.data
  return {
    ...env,
    storageLocalDir: resolve(repoRoot, env.STORAGE_LOCAL_DIR),
    repoRoot,
    isProd: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
  }
}
