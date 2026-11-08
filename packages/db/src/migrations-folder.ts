import { fileURLToPath } from 'node:url'

/** Absolute path to the generated SQL migrations, valid from source or from a bundle. */
export const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url))
