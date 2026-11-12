import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Runs `drizzle-kit generate` (extra arguments are passed on, e.g. `--name add_reviews`), then
 * makes sure the `init` migration creates the Postgres extensions the schema needs.
 *
 * drizzle-kit does not write `CREATE EXTENSION`, and a line added by hand to a generated file is
 * lost the next time that migration is regenerated. Always generate through this script
 * (`npm run db:generate`), never with `drizzle-kit generate` directly.
 */
const EXTENSIONS = ['citext', 'pg_trgm']

const packageDir = fileURLToPath(new URL('..', import.meta.url))
const drizzleDir = join(packageDir, 'drizzle')

const kit = spawnSync('npx', ['drizzle-kit', 'generate', ...process.argv.slice(2)], {
  cwd: packageDir,
  stdio: 'inherit',
})
if (kit.status !== 0) process.exit(kit.status ?? 1)

const initFolders = readdirSync(drizzleDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.endsWith('_init'))
  .map((entry) => entry.name)
if (initFolders.length !== 1) {
  console.error(
    `expected exactly one "<timestamp>_init" folder in ${drizzleDir}, found ${initFolders.length}`,
  )
  process.exit(1)
}

const file = join(drizzleDir, initFolders[0] as string, 'migration.sql')
const sql = readFileSync(file, 'utf8')
const missing = EXTENSIONS.filter(
  (name) => !new RegExp(`^CREATE EXTENSION IF NOT EXISTS "?${name}"?;`, 'im').test(sql),
)
if (missing.length > 0) {
  const header = missing
    .map((name) => `CREATE EXTENSION IF NOT EXISTS ${name};\n--> statement-breakpoint\n`)
    .join('')
  writeFileSync(file, header + sql)
  console.log(`added CREATE EXTENSION for ${missing.join(', ')} to ${initFolders[0]}/migration.sql`)
}
