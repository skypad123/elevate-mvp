import type { Db, NodeLearnerDb } from './client'
import type { PgliteDb, PgliteLearnerDb } from './pglite'

export * from './client'
export { learnerRelations } from './learner-relations'
export { migrationsFolder } from './migrations-folder'
export type { PgliteDb, PgliteLearnerDb } from './pglite'
export * as schema from './schema'
export * from './schema'

/** Either driver; both expose the same Drizzle API so services can be tested on PGlite. */
export type AnyDb = Db | PgliteDb

/**
 * The client learner-facing services read course content with. Its relations reach lessons,
 * artefacts, quizzes and prerequisite links only through the live views, so it has no
 * `query.lessons`, `query.artefacts`, `query.quizzes` or `query.lessonPrerequisites`.
 */
export type LearnerDb = NodeLearnerDb | PgliteLearnerDb
