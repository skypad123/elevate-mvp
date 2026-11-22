import { createDeps } from './deps'
import { loadEnv } from './env'
import { CoursePreviewService } from './services/course-preview.service'

/**
 * Hover-preview commands, run by hand as one-off tasks from the API image (ADR 011):
 *
 *   node dist/previews.js backfill                      refresh every live course's clip
 *   node dist/previews.js count                         live courses, and how many have a clip
 *   node dist/previews.js check <mediaId> [--start 10]  ask Mux for one clip of a video
 *
 * Each prints its result as one line of JSON, the last line printed. A command that ran exits 0
 * whatever it reports. `check` uses one of the video's clips for good, so run it on a video
 * Elevate uploaded, not on a teacher's.
 */
const USAGE = 'usage: node dist/previews.js backfill | count | check <mediaId> [--start <seconds>]'

const [command, ...rest] = process.argv.slice(2)

function parseCheck(args: string[]): { mediaId: string; startSeconds?: number } | null {
  const [mediaId, ...flags] = args
  if (!mediaId || mediaId.startsWith('--')) return null
  if (flags.length === 0) return { mediaId }
  if (flags.length !== 2 || flags[0] !== '--start' || !/^\d+$/.test(flags[1] as string)) return null
  return { mediaId, startSeconds: Number(flags[1]) }
}

const check = command === 'check' ? parseCheck(rest) : null
if (!['backfill', 'count', 'check'].includes(command ?? '') || (command === 'check' && !check)) {
  console.error(USAGE)
  process.exit(1)
}

const deps = await createDeps(loadEnv())
const previews = new CoursePreviewService(deps)
let failed = false
try {
  const result =
    command === 'backfill'
      ? await previews.backfill()
      : command === 'count'
        ? await previews.count()
        : await previews.check(check?.mediaId as string, check?.startSeconds)
  console.log(JSON.stringify(result))
} catch (error) {
  console.error(error)
  failed = true
} finally {
  await deps.close()
}
process.exit(failed ? 1 : 0)
