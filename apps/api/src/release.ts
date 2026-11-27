import { createDeps } from './deps'
import { loadEnv } from './env'
import { ReleaseService } from './services/release.service'

/**
 * One run of the release job (docs/designs/scheduled-classes-selling.md, "One run"): seat refunds
 * sent, class money released, profiles paid. EventBridge Scheduler starts it every 15 minutes as a
 * one-off task from the API's image, whose `release` task definition has `node dist/release.js`
 * as its command, because a schedule cannot change the command of the task it starts. It builds
 * its dependencies as the server does and connects as the API's restricted database user, with
 * `DATABASE_URL`.
 *
 * Exit 0 when the run returned, including a run that found another holding the lock and a run in
 * which a step failed (recorded in the run's row and logged); exit 1 when it threw before its
 * `release_run_finished` log line.
 */
const env = loadEnv()
const deps = await createDeps(env)
let code = 0
try {
  await new ReleaseService(deps).run(new Date())
} catch (error) {
  deps.log.error('release run failed', {
    event: 'release_run_failed',
    error: error instanceof Error ? error.message : String(error),
  })
  code = 1
} finally {
  await deps.close()
}
process.exit(code)
