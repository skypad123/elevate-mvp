import type { Db } from './client'
import type { PgliteDb } from './pglite'

export * from './client'
export { migrationsFolder } from './migrations-folder'
export type { PgliteDb } from './pglite'
export * as schema from './schema'
export * from './schema'

/** Either driver; both expose the same Drizzle API so services can be tested on PGlite. */
export type AnyDb = Db | PgliteDb
