import { resolve } from 'node:path'
import { createDb } from '../src/client'
import { seedDatabase } from '../src/seed'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set (copy .env.example to .env)')
const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL
if (!superAdminEmail) throw new Error('SEED_SUPER_ADMIN_EMAIL is not set')

const repoRoot = resolve(import.meta.dirname, '../../..')
const storageDir = resolve(repoRoot, process.env.STORAGE_LOCAL_DIR ?? '.data/storage')

const { db, pool } = createDb(url)
await seedDatabase(db, { superAdminEmail, storageDir, log: (m) => console.log(`seed: ${m}`) })
await pool.end()
