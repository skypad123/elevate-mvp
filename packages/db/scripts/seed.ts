import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createDb } from '../src/client'
import { type SeedStorage, seedDatabase } from '../src/seed'

/**
 * Local development seed (`npm run db:seed`): the full demo data, with thumbnails written to the
 * local storage folder. Deployed environments seed from the API image instead (`node dist/seed.js`).
 */
const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set (copy .env.example to .env)')
const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL
if (!superAdminEmail) throw new Error('SEED_SUPER_ADMIN_EMAIL is not set')

const repoRoot = resolve(import.meta.dirname, '../../..')
const storageDir = resolve(repoRoot, process.env.STORAGE_LOCAL_DIR ?? '.data/storage')

const storage: SeedStorage = {
  provider: 'local',
  async put(key, body) {
    const file = join(storageDir, key)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, body)
  },
}

const { db, pool } = createDb(url)
await seedDatabase(db, {
  superAdminEmail,
  mode: 'demo',
  storage,
  log: (m) => console.log(`seed: ${m}`),
})
await pool.end()
