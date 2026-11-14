import { fileURLToPath } from 'node:url'

/**
 * Absolute path to the generated SQL migrations. From source this is `packages/db/drizzle`; a
 * bundle that inlines this package sits elsewhere, so it points here with `MIGRATIONS_DIR`.
 */
export const migrationsFolder =
  process.env.MIGRATIONS_DIR || fileURLToPath(new URL('../drizzle', import.meta.url))
