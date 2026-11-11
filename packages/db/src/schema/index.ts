/**
 * Constraint names and check expressions written out by hand in these files (for example
 * `.unique('sessions_tokenHash_unique')`, or `sql.raw(...)` inside `check()`) repeat exactly what
 * the applied migrations created. drizzle-kit 1.0 picks different default names for unique
 * constraints and prints check expressions differently from 0.31, so leaving them implicit would
 * generate a migration that only renames things. Drop them when the migrations are next squashed
 * into a new baseline.
 */
export * from './auth'
export * from './commerce'
export * from './courses'
export * from './enums'
export * from './learning'
export * from './media'
export * from './relations'
export * from './system'
export * from './teachers'
