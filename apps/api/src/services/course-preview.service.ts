import { randomUUID } from 'node:crypto'
import {
  COURSE_PREVIEW,
  type PreviewVideo,
  previewChangesLeft,
  previewIsShown,
  resolvePreview,
  uuidSchema,
} from '@elevate/core'
import { schema as s } from '@elevate/db'
import { and, asc, eq, isNull, type SQL, sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import type { Deps } from '../deps'
import type { MediaAssetRow } from '../providers/video'

/**
 * The hover preview on a course card (docs/designs/learner-hover-preview.md, ADR 011).
 *
 * This is the only code that makes, replaces or clears a course's clip. A clip is a short silent
 * animated WebP fetched once from Mux and stored under a new `public/previews/` key, because
 * public files are cached as immutable.
 *
 * One rule holds throughout: `preview_key` is emptied or replaced only after the delete of that
 * key's file has succeeded. A row with a key and an empty source record means "hidden, file still
 * to be deleted"; the catalog, the course view and the count all treat it as no clip.
 *
 * Course content is read through `learnerDb`, so only live rows are seen. Writes touch only
 * `courses` and the one counter on `media_assets`, and keep each row's `updated_at` as it was.
 */

/** What one `refresh` did. */
export type RefreshOutcome =
  | 'made'
  | 'unchanged'
  | 'cleared'
  | 'none'
  | 'not_live'
  | 'paused'
  | 'limit'
  | 'failed'

const OUTCOMES: readonly RefreshOutcome[] = [
  'made',
  'unchanged',
  'cleared',
  'none',
  'not_live',
  'paused',
  'limit',
  'failed',
]

type PreviewMedia = Pick<
  MediaAssetRow,
  'id' | 'kind' | 'provider' | 'status' | 'playbackId' | 'durationSeconds' | 'previewFetches'
>

/** A video item whose file can give a clip: a ready Mux video of at least the minimum length. */
export function isUsableVideo(media: PreviewMedia): boolean {
  return (
    media.kind === 'video' &&
    media.provider === 'mux' &&
    media.status === 'ready' &&
    !!media.playbackId &&
    (media.durationSeconds ?? 0) >= COURSE_PREVIEW.minDurationSeconds
  )
}

/**
 * The rule's input from a course's items in order. Only video items count, and an item with no
 * file is left out: it has no media ID to name.
 */
export function videosOf(
  items: ReadonlyArray<{ type: string; media: PreviewMedia | null }>,
): PreviewVideo[] {
  return items.flatMap((item) =>
    item.type === 'video' && item.media
      ? [
          {
            mediaId: item.media.id,
            usable: isUsableVideo(item.media),
            durationSeconds: item.media.durationSeconds,
          },
        ]
      : [],
  )
}

/** A column equals a value; two empty values count as equal. */
const same = (column: AnyPgColumn, value: string | number | boolean | null): SQL =>
  value === null ? isNull(column) : eq(column, value)

/** Assigns a row's `updated_at` to itself, so its on-update default does not run. */
const keepCourseUpdatedAt = { updatedAt: sql`${s.courses.updatedAt}` }

type SettingSeen = Pick<
  typeof s.courses.$inferSelect,
  'previewEnabled' | 'previewMediaId' | 'previewStartSeconds'
>

export class CoursePreviewService {
  constructor(private readonly deps: Deps) {}

  /** The course with its live lessons and items in learner order, each with its file. */
  private readCourse(courseId: string) {
    return this.deps.learnerDb.query.courses.findFirst({
      where: { id: courseId },
      with: {
        liveLessons: {
          orderBy: { position: 'asc', createdAt: 'asc' },
          with: {
            liveArtefacts: {
              orderBy: { position: 'asc', createdAt: 'asc' },
              with: { media: true },
            },
          },
        },
      },
    })
  }

  /** The guard of steps 4, 8 and 9: the key this run last saw, and the setting read in step 1. */
  private guard(courseId: string, key: string | null, seen: SettingSeen): SQL {
    return and(
      eq(s.courses.id, courseId),
      same(s.courses.previewKey, key),
      eq(s.courses.previewEnabled, seen.previewEnabled),
      same(s.courses.previewMediaId, seen.previewMediaId),
      same(s.courses.previewStartSeconds, seen.previewStartSeconds),
    ) as SQL
  }

  /** Empties the source record where `where` holds. True when a row changed. */
  private async hide(where: SQL): Promise<boolean> {
    const rows = await this.deps.db
      .update(s.courses)
      .set({ previewSourceMediaId: null, previewSourceStartSeconds: null, ...keepCourseUpdatedAt })
      .where(where)
      .returning({ id: s.courses.id })
    return rows.length > 0
  }

  /**
   * Hide, delete, forget: the retire step that `refresh` and `retireIfVideoGone` share.
   * - `lost`: the hide's guard matched no row; nothing was done.
   * - `delete_failed`: hidden, and the key stays on the row for the next refresh.
   */
  private async retire(
    courseId: string,
    key: string,
    hideWhere: SQL,
  ): Promise<'done' | 'lost' | 'delete_failed'> {
    if (!(await this.hide(hideWhere))) return 'lost'
    try {
      await this.deps.storage.delete(key)
    } catch (error) {
      this.deps.log.warn('course preview delete failed', { courseId, key, error: String(error) })
      return 'delete_failed'
    }
    // The file is gone whatever the setting now says, so this compares the key alone.
    await this.deps.db
      .update(s.courses)
      .set({ previewKey: null, ...keepCourseUpdatedAt })
      .where(and(eq(s.courses.id, courseId), eq(s.courses.previewKey, key)))
    return 'done'
  }

  /** Deletes a file this run wrote and will not use. Never throws. */
  private async discard(courseId: string, key: string): Promise<void> {
    try {
      await this.deps.storage.delete(key)
    } catch (error) {
      this.deps.log.warn('course preview discard failed', { courseId, key, error: String(error) })
    }
  }

  /** Adds one to the video's clip count, in SQL, so two refreshes can't lose each other's count. */
  private async countFetch(mediaId: string): Promise<void> {
    await this.deps.db
      .update(s.mediaAssets)
      .set({
        previewFetches: sql`${s.mediaAssets.previewFetches} + 1`,
        updatedAt: sql`${s.mediaAssets.updatedAt}`,
      })
      .where(eq(s.mediaAssets.id, mediaId))
  }

  /**
   * Brings a course's clip up to date with the rule. Never throws: an error is logged and reported
   * as `failed`. The steps are numbered as in the design.
   */
  async refresh(courseId: string): Promise<RefreshOutcome> {
    const { env, log, storage, video } = this.deps
    try {
      // 1. Read. 2. Live.
      const course = await this.readCourse(courseId)
      if (course?.status !== 'live') return 'not_live'
      const items = course.liveLessons.flatMap((l) => l.liveArtefacts)
      const videos = videosOf(items)
      const seen: SettingSeen = {
        previewEnabled: course.previewEnabled,
        previewMediaId: course.previewMediaId,
        previewStartSeconds: course.previewStartSeconds,
      }

      // 3. Decide.
      const wanted = resolvePreview(
        {
          enabled: course.previewEnabled,
          mediaId: course.previewMediaId,
          startSeconds: course.previewStartSeconds,
        },
        videos,
      )

      // 4. Retire: nothing wanted, a leftover from a failed delete, or the clip's video gone.
      let key = course.previewKey
      const source = course.previewSourceMediaId
      const sourceGone = source !== null && !videos.some((v) => v.mediaId === source)
      if (key && (!wanted || source === null || sourceGone)) {
        const result = await this.retire(courseId, key, this.guard(courseId, key, seen))
        if (result === 'lost') return 'unchanged'
        if (result === 'delete_failed') return 'failed'
        if (!wanted) return 'cleared'
        key = null
      }
      if (!wanted) return 'none'

      // 5. Paused.
      if (!env.COURSE_PREVIEWS) return 'paused'

      // 6. Unchanged.
      if (
        key &&
        course.previewSourceMediaId === wanted.mediaId &&
        course.previewSourceStartSeconds === wanted.startSeconds
      ) {
        return 'unchanged'
      }

      // 7. Fetch and store.
      const media = items.find((i) => i.media?.id === wanted.mediaId)?.media
      if (!media) return 'unchanged'
      if (previewChangesLeft(media.previewFetches) === 0) return 'limit'
      const clip = await video.animatedPreview(media, {
        startSeconds: wanted.startSeconds,
        endSeconds: wanted.startSeconds + COURSE_PREVIEW.lengthSeconds,
        width: COURSE_PREVIEW.width,
        fps: COURSE_PREVIEW.fps,
      })
      if (!clip) {
        log.warn('course preview fetch returned no clip', { courseId, mediaId: media.id })
        return 'failed'
      }
      await this.countFetch(media.id)
      const newKey = `public/previews/${courseId}/${randomUUID()}.webp`
      await storage.put(newKey, clip.bytes, clip.mimeType)

      // 7.5 Look again: a direct edit may have removed the video while Mux was answering.
      const again = await this.readCourse(courseId)
      const stillThere =
        again &&
        videosOf(again.liveLessons.flatMap((l) => l.liveArtefacts)).some(
          (v) => v.mediaId === wanted.mediaId,
        )
      if (!stillThere) {
        await this.discard(courseId, newKey)
        return 'unchanged'
      }

      // 8. Retire the old clip, when this is a replacement.
      if (key) {
        if (!(await this.hide(this.guard(courseId, key, seen)))) {
          await this.discard(courseId, newKey)
          return 'unchanged'
        }
        try {
          await storage.delete(key)
        } catch (error) {
          log.warn('course preview delete failed', { courseId, key, error: String(error) })
          await this.discard(courseId, newKey)
          return 'failed'
        }
      }

      // 9. Point the course at the new file. If this throws its result is unknown, so the file is
      // left where it is: deleting it could leave the row pointing at a file that is gone.
      const pointed = await this.deps.db
        .update(s.courses)
        .set({
          previewKey: newKey,
          previewSourceMediaId: wanted.mediaId,
          previewSourceStartSeconds: wanted.startSeconds,
          ...keepCourseUpdatedAt,
        })
        .where(this.guard(courseId, key, seen))
        .returning({ id: s.courses.id })
      if (!pointed.length) {
        await this.discard(courseId, newKey)
        return 'unchanged'
      }
      return 'made'
    } catch (error) {
      log.warn('course preview refresh failed', { courseId, error: String(error) })
      return 'failed'
    }
  }

  /**
   * After a direct edit to a live course: deletes the clip when its video has left the course.
   * Never asks Mux and never throws. Runs whether or not previews are switched on.
   */
  async retireIfVideoGone(courseId: string): Promise<void> {
    const { learnerDb, log } = this.deps
    try {
      const course = await learnerDb.query.courses.findFirst({
        where: { id: courseId },
        columns: { status: true, previewKey: true, previewSourceMediaId: true },
      })
      if (course?.status !== 'live' || !course.previewKey) return
      const { previewKey: key, previewSourceMediaId: source } = course
      if (!source) return
      const content = await learnerDb.query.courses.findFirst({
        where: { id: courseId },
        columns: { id: true },
        with: {
          liveLessons: {
            columns: { id: true },
            with: { liveArtefacts: { columns: { type: true, mediaAssetId: true } } },
          },
        },
      })
      const stillThere = content?.liveLessons.some((l) =>
        l.liveArtefacts.some((a) => a.type === 'video' && a.mediaAssetId === source),
      )
      if (stillThere) return
      await this.retire(
        courseId,
        key,
        and(
          eq(s.courses.id, courseId),
          eq(s.courses.previewKey, key),
          eq(s.courses.previewSourceMediaId, source),
        ) as SQL,
      )
    } catch (error) {
      log.warn('course preview retire failed', { courseId, error: String(error) })
    }
  }

  // ── commands (`src/previews.ts`) ─────────────────────────────────────────

  /** `refresh` for every live course, one at a time in ID order, with a count of each outcome. */
  async backfill(): Promise<Record<RefreshOutcome, number>> {
    const counts = Object.fromEntries(OUTCOMES.map((o) => [o, 0])) as Record<RefreshOutcome, number>
    const rows = await this.deps.db
      .select({ id: s.courses.id })
      .from(s.courses)
      .where(eq(s.courses.status, 'live'))
      .orderBy(asc(s.courses.id))
    for (const { id } of rows) counts[await this.refresh(id)]++
    return counts
  }

  /** The live courses, and how many of them have a clip a visitor can see. */
  async count(): Promise<{ live: number; withClip: number }> {
    const rows = await this.deps.db
      .select({
        enabled: s.courses.previewEnabled,
        previewKey: s.courses.previewKey,
        sourceMediaId: s.courses.previewSourceMediaId,
      })
      .from(s.courses)
      .where(eq(s.courses.status, 'live'))
    const previewsOn = this.deps.env.COURSE_PREVIEWS
    return {
      live: rows.length,
      withClip: rows.filter((r) => previewIsShown({ ...r, previewsOn })).length,
    }
  }

  /**
   * Asks Mux for one clip of a video and reports what came back. Stores nothing and changes no
   * course, but a clip that comes back is a real fetch, so it is counted against the video. The
   * allowance is not tested first: this is an operator's tool.
   */
  async check(
    mediaId: string,
    startSeconds: number = COURSE_PREVIEW.defaultStartSeconds,
  ): Promise<{ ok: boolean; bytes: number | null; mimeType: string | null; milliseconds: number }> {
    const none = { ok: false, bytes: null, mimeType: null, milliseconds: 0 }
    if (!uuidSchema.safeParse(mediaId).success) return none
    const media = await this.deps.db.query.mediaAssets.findFirst({ where: { id: mediaId } })
    if (media?.kind !== 'video' || media.provider !== 'mux' || media.status !== 'ready') return none
    const started = performance.now()
    const clip = await this.deps.video.animatedPreview(media, {
      startSeconds,
      endSeconds: startSeconds + COURSE_PREVIEW.lengthSeconds,
      width: COURSE_PREVIEW.width,
      fps: COURSE_PREVIEW.fps,
    })
    const milliseconds = Math.round(performance.now() - started)
    if (!clip) return { ...none, milliseconds }
    await this.countFetch(media.id)
    return { ok: true, bytes: clip.bytes.byteLength, mimeType: clip.mimeType, milliseconds }
  }
}
