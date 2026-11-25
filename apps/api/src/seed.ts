import { createDb } from '@elevate/db'
import { seedDatabase } from '@elevate/db/seed'
import { loadEnv } from './env'
import { createStorage } from './providers/storage'

/**
 * Seeds a deployed database as a one-off task from the API image:
 *
 *   node dist/seed.js --demo         the super admin plus the demo teachers, courses and learner
 *   node dist/seed.js --admin-only   the super admin and nothing else
 *
 * Thumbnails go through the API's own storage provider, so they land in S3 where S3 is configured.
 *
 * With `CLASSES` on, `--demo` also creates the demo class and its class learners, and adds the
 * comma-separated addresses in `SEED_CLASS_LEARNER_EMAILS` to it (passed as an override on the
 * one-off task). With `CLASSES` off it creates no class data.
 */
const mode = process.argv.includes('--demo')
  ? 'demo'
  : process.argv.includes('--admin-only')
    ? 'admin-only'
    : null
if (!mode) {
  console.error('usage: node dist/seed.js --demo | --admin-only')
  process.exit(1)
}

const env = loadEnv()
const superAdminEmail = env.SEED_SUPER_ADMIN_EMAIL
if (!superAdminEmail) {
  console.error('SEED_SUPER_ADMIN_EMAIL is not set')
  process.exit(1)
}

function splitEmails(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean)
}

const storage = createStorage(env)
const { db, pool } = createDb(env.DATABASE_URL)
try {
  await seedDatabase(db, {
    superAdminEmail,
    mode,
    storage: {
      provider: storage.driver === 's3' ? 's3' : 'local',
      put: (key, body, mimeType) => storage.put(key, body, mimeType),
    },
    log: (message) => console.log(`seed: ${message}`),
    classes: env.CLASSES,
    classLearnerEmails: splitEmails(env.SEED_CLASS_LEARNER_EMAILS),
  })
  console.log(`seed (${mode}) finished`)
} finally {
  await pool.end()
}
