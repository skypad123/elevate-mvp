import type { CheckInLocation } from '@elevate/core'

/**
 * The installed app reads no location: it has no location module, and adding one is a later
 * decision (docs/designs/scheduled-classes-attendance.md). A check-in from the app says so, and
 * the instructor sees it flagged "checked in from the app, no location".
 */
export async function readLocation(): Promise<CheckInLocation> {
  return { status: 'unsupported' }
}
