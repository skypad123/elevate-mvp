/**
 * The hover preview on a course card: a short silent clip cut from one of the course's videos
 * (docs/designs/learner-hover-preview.md, ADR 011). These rules decide which video and which
 * second the clip shows, and what Teach is told about it. The API, Teach and Support all use them,
 * so they cannot disagree.
 */

export const COURSE_PREVIEW = {
  /** The clip's width in pixels. No height is sent, so the clip keeps the video's own shape. */
  width: 480,
  lengthSeconds: 4,
  fps: 10,
  defaultStartSeconds: 10,
  /** A video shorter than this starts its default clip at second 0. */
  minDurationForDefaultStart: 15,
  /** A video shorter than this is not usable for a clip. */
  minDurationSeconds: 5,
  /** The clip ends at least this long before the video's stored length. */
  endMarginSeconds: 1,
  maxStartSeconds: 86_400,
  startStepSeconds: 10,
  /**
   * How many clips Elevate asks Mux for, per video, ever: half of the least Mux's guide gives any
   * video. Read only through `previewChangesLeft`.
   */
  maxClipsPerVideo: 5,
  maxBytes: 3_000_000,
  fetchTimeoutMs: 10_000,
} as const

/** The teacher's setting. An empty video or start means the default. */
export type PreviewSetting = {
  enabled: boolean
  mediaId: string | null
  startSeconds: number | null
}

/**
 * One video item among the course's live rows, in the order a learner sees them.
 * `durationSeconds` is the media row's stored length, never the item's. `usable` is decided by the
 * API and already includes the `minDurationSeconds` minimum.
 */
export type PreviewVideo = { mediaId: string; usable: boolean; durationSeconds: number | null }

export type ResolvedPreview = { mediaId: string; startSeconds: number }

export type CoursePreviewState =
  | 'off'
  | 'no_video'
  | 'not_live'
  | 'paused'
  | 'limit'
  | 'pending'
  | 'ready'

/**
 * The starts a clip of this video may have: 0, 10, 20 and so on, for as long as the clip ends at
 * least `endMarginSeconds` before the video's stored length.
 */
export function allowedStarts(durationSeconds: number): number[] {
  const { startStepSeconds, lengthSeconds, endMarginSeconds, maxStartSeconds } = COURSE_PREVIEW
  const last = Math.round(durationSeconds) - endMarginSeconds - lengthSeconds
  const out: number[] = []
  for (let s = 0; s <= last && s <= maxStartSeconds; s += startStepSeconds) out.push(s)
  return out
}

/** The clips this video can still have fetched. Never below 0: the count can pass the allowance. */
export function previewChangesLeft(previewFetches: number): number {
  return Math.max(0, COURSE_PREVIEW.maxClipsPerVideo - previewFetches)
}

function defaultStart(durationSeconds: number): number {
  return durationSeconds >= COURSE_PREVIEW.minDurationForDefaultStart
    ? COURSE_PREVIEW.defaultStartSeconds
    : 0
}

/** The last allowed start that is not above `wanted`, or 0. */
function lowerToAllowed(wanted: number, durationSeconds: number): number {
  let best = 0
  for (const s of allowedStarts(durationSeconds)) if (s <= wanted) best = s
  return best
}

/**
 * What the course's clip should be, or nothing.
 *
 * 1. Off gives nothing.
 * 2. A chosen video that is usable on the course is used; otherwise the first usable video.
 * 3. A chosen start belongs to the chosen video: it is dropped when the chosen video is not usable
 *    and the rule falls back. With no chosen video it goes with whichever video is the default.
 *    It is lowered to the video's last allowed start when needed.
 */
export function resolvePreview(
  setting: PreviewSetting,
  videos: readonly PreviewVideo[],
): ResolvedPreview | null {
  if (!setting.enabled) return null
  const seen = new Set<string>()
  const usable: Array<{ mediaId: string; durationSeconds: number }> = []
  for (const v of videos) {
    if (seen.has(v.mediaId)) continue
    seen.add(v.mediaId)
    if (v.usable && v.durationSeconds !== null)
      usable.push({ mediaId: v.mediaId, durationSeconds: v.durationSeconds })
  }
  const chosen = setting.mediaId ? usable.find((v) => v.mediaId === setting.mediaId) : undefined
  const video = chosen ?? usable[0]
  if (!video) return null
  const keepsStart = setting.mediaId === null || chosen !== undefined
  const startSeconds =
    keepsStart && setting.startSeconds !== null
      ? lowerToAllowed(setting.startSeconds, video.durationSeconds)
      : defaultStart(video.durationSeconds)
  return { mediaId: video.mediaId, startSeconds }
}

const sameResolved = (a: ResolvedPreview | null, b: ResolvedPreview | null) =>
  a !== null && b !== null && a.mediaId === b.mediaId && a.startSeconds === b.startSeconds

/** What Teach is told about a course's clip: the first state that applies. */
export function previewState(input: {
  setting: PreviewSetting
  resolved: ResolvedPreview | null
  courseStatus: string
  previewKey: string | null
  source: ResolvedPreview | null
  previewsOn: boolean
  /** `previewChangesLeft` for the resolved video; 0 when nothing is resolved. */
  changesLeft: number
}): CoursePreviewState {
  if (!input.setting.enabled) return 'off'
  if (!input.previewsOn) return 'paused'
  if (!input.resolved) return 'no_video'
  if (input.courseStatus !== 'live') return 'not_live'
  if (input.previewKey && sameResolved(input.source, input.resolved)) return 'ready'
  if (input.changesLeft === 0) return 'limit'
  return 'pending'
}

/**
 * The one test for "a visitor can see this clip". A key with no recorded source is a clip that is
 * hidden, its file still to be deleted.
 */
export function previewIsShown(input: {
  enabled: boolean
  previewKey: string | null
  sourceMediaId: string | null
  previewsOn: boolean
}): boolean {
  return input.enabled && !!input.previewKey && !!input.sourceMediaId && input.previewsOn
}

/** `0:10`, `1:35`, and from an hour `1:02:05`. */
export function formatPreviewStart(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}
