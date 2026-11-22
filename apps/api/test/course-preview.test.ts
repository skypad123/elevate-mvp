import { COURSE_PREVIEW, previewChangesLeft } from '@elevate/core'
import { schema as s } from '@elevate/db'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app'
import { CoursePreviewService } from '../src/services/course-preview.service'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * The hover preview on course cards (docs/designs/learner-hover-preview.md, item 16), on the fake
 * video and storage drivers. A fixture course with `videos: 1` has a 60-second video in its first
 * lesson; `videos: 2` adds one to its second lesson.
 */

type Preview = {
  enabled: boolean
  mediaId: string | null
  startSeconds: number | null
  resolved: { mediaId: string; startSeconds: number } | null
  videos: Array<{ mediaId: string; lessonTitle: string; itemTitle: string; changesLeft: number }>
  clipUrl: string | null
  state: string
}

/** Helpers bound to one test app and one profile. */
function bind(app: TestApp, profileId: string, owner: string) {
  const previews = new CoursePreviewService(app.deps)
  let n = 0
  const teach = (path: string) => `/api/teach/profiles/${profileId}${path}`
  const helpers = {
    previews,
    teach,
    /** A fixture course with a title the catalog search finds alone. */
    async course(options: Parameters<TestApp['createCourse']>[1] = {}) {
      const title = `Preview fixture ${++n} q${Math.random().toString(36).slice(2, 7)}`
      return { ...(await app.createCourse(profileId, { title, ...options })), title }
    },
    /** A live course with its clip already made. */
    async live(options: { videos?: 1 | 2; videoSeconds?: number } = {}) {
      const c = await helpers.course({ status: 'live', videos: options.videos ?? 1, ...options })
      expect(await previews.refresh(c.courseId)).toBe('made')
      const key = (await helpers.row(c.courseId)).previewKey as string
      return { ...c, key }
    },
    row: async (courseId: string) =>
      (await app.db.query.courses.findFirst({
        where: { id: courseId },
      })) as typeof s.courses.$inferSelect,
    media: async (mediaId: string) =>
      (await app.db.query.mediaAssets.findFirst({
        where: { id: mediaId },
      })) as typeof s.mediaAssets.$inferSelect,
    preview: async (courseId: string, token = owner, draft = false): Promise<Preview> =>
      (await app.api('GET', teach(`/courses/${courseId}${draft ? '?draft=1' : ''}`), { token }))
        .body.course.preview,
    patch: (courseId: string, body: Record<string, unknown>, token = owner) =>
      app.api('PATCH', teach(`/courses/${courseId}`), { token, body }),
    /** The catalog card's `previewUrl`, or undefined when the course is not listed. */
    async previewUrl(c: { courseId: string; title: string }, token?: string) {
      const list = await app.api('GET', `/api/catalog/courses?q=${encodeURIComponent(c.title)}`, {
        token,
      })
      return list.body.items.find((i: { id: string }) => i.id === c.courseId)?.previewUrl as
        | string
        | null
        | undefined
    },
    objects: (courseId: string) =>
      [...app.storage.objects.keys()].filter((k) => k.startsWith(`public/previews/${courseId}/`)),
    calls: () => app.video.previewCalls,
    async audits(courseId: string) {
      return app.db
        .select()
        .from(s.auditLog)
        .where(and(eq(s.auditLog.entityId, courseId), eq(s.auditLog.action, 'course.preview')))
    },
    async setFetches(mediaId: string, previewFetches: number) {
      await app.db
        .update(s.mediaAssets)
        .set({ previewFetches })
        .where(eq(s.mediaAssets.id, mediaId))
    },
  }
  return helpers
}

function reset(app: TestApp) {
  app.video.previewCalls.length = 0
  app.video.previewMode = 'ok'
  app.video.onPreview = undefined
  app.storage.failDeleteKeys.clear()
}

let t: TestApp
let profileId: string
let owner: string
let writer: string
let agent: string
let h: ReturnType<typeof bind>

beforeAll(async () => {
  t = await createTestApp()
  profileId = (await t.createProfile('owner@example.com', { payable: true })).profile.id
  await t.addMember(profileId, 'writer@example.com', 'writer')
  await t.grantRole('agent@example.com', 'support_agent')
  owner = (await t.signIn('owner@example.com', 'teach')).token as string
  writer = (await t.signIn('writer@example.com', 'teach')).token as string
  agent = (await t.signIn('agent@example.com', 'support')).token as string
  h = bind(t, profileId, owner)
})
afterAll(async () => {
  await t.close()
})
beforeEach(() => reset(t))

const approve = (courseId: string) =>
  t.api('POST', `/api/support/courses/${courseId}/approve`, { token: agent })
const PREVIEW_PARAGRAPH = 'short silent preview'
const approvalMail = (title: string) =>
  t.mailer.sent.filter((m) => m.subject.includes(title) && m.subject.includes('is live'))

describe('making the clip', () => {
  it('Support approval makes the clip, and the email says so', async () => {
    const c = await h.course({ status: 'pending_review', videos: 1 })
    expect((await approve(c.courseId)).status).toBe(200)
    expect(h.calls()).toEqual([
      {
        assetId: c.videos[0]?.mediaId,
        options: { startSeconds: 10, endSeconds: 14, width: 480, fps: 10 },
      },
    ])
    const [key] = h.objects(c.courseId)
    expect(h.objects(c.courseId)).toHaveLength(1)
    expect(t.storage.objects.get(key as string)?.mimeType).toBe('image/webp')
    const url = await h.previewUrl(c)
    expect(url).toBeTruthy()
    const served = await t.app.request(new URL(url as string).pathname)
    expect(served.status).toBe(200)
    expect(served.headers.get('content-type')).toBe('image/webp')
    expect(served.headers.get('cache-control')).toContain('immutable')
    const mails = approvalMail(c.title)
    expect(mails.length).toBeGreaterThan(0)
    expect(mails.every((m) => m.text.includes(PREVIEW_PARAGRAPH))).toBe(true)
  })

  it('makes no clip for a course with no video', async () => {
    const c = await h.course({ status: 'pending_review' })
    expect((await approve(c.courseId)).status).toBe(200)
    expect(h.calls()).toHaveLength(0)
    expect(await h.previewUrl(c)).toBeNull()
    expect(approvalMail(c.title).some((m) => m.text.includes(PREVIEW_PARAGRAPH))).toBe(false)
  })

  for (const mode of ['null', 'throw'] as const) {
    it(`does not block anything when the driver returns ${mode}`, async () => {
      // Support's approval.
      t.video.previewMode = mode
      const pending = await h.course({ status: 'pending_review', videos: 1 })
      const approved = await approve(pending.courseId)
      expect(approved.status).toBe(200)
      expect(approved.body.course.status).toBe('live')
      expect((await h.row(pending.courseId)).previewKey).toBeNull()

      // A save that changes the start keeps the old clip and says it is not up to date.
      t.video.previewMode = 'ok'
      const c = await h.live({ videos: 2 })
      t.video.previewMode = mode
      const saved = await h.patch(c.courseId, { previewStartSeconds: 30 })
      expect(saved.status).toBe(200)
      expect(saved.body.course.preview.state).toBe('pending')
      expect((await h.row(c.courseId)).previewKey).toBe(c.key)
      expect(await h.previewUrl(c)).toBeTruthy()

      // A change-set approval that leaves the clip's video on the course keeps the old clip.
      await t.api('PATCH', h.teach(`/lessons/${c.lessonB}`), {
        token: writer,
        body: { title: 'Second lesson, renamed' },
      })
      const csApproved = await t.api('POST', h.teach(`/courses/${c.courseId}/change-set/approve`), {
        token: owner,
      })
      expect(csApproved.status).toBe(200)
      expect((await h.row(c.courseId)).previewKey).toBe(c.key)
      expect(h.objects(c.courseId)).toEqual([c.key])
    })
  }

  it('records the audit row of a save before waiting on Mux', async () => {
    const c = await h.course({ status: 'live', videos: 1 })
    let seen = -1
    t.video.onPreview = async () => {
      seen = (await h.audits(c.courseId)).length
    }
    expect((await h.patch(c.courseId, { previewStartSeconds: 30 })).status).toBe(200)
    expect(seen).toBe(1)
  })

  it("makes a teacher's choice with a new key, and repeats ask for nothing", async () => {
    const c = await h.live({ videos: 2 })
    const second = c.videos[1]?.mediaId as string
    const saved = await h.patch(c.courseId, { previewMediaId: second, previewStartSeconds: 30 })
    expect(saved.status).toBe(200)
    const row = await h.row(c.courseId)
    expect(row.previewKey).not.toBe(c.key)
    expect(row.previewSourceMediaId).toBe(second)
    expect(row.previewSourceStartSeconds).toBe(30)
    expect(t.storage.objects.has(c.key)).toBe(false)
    expect(h.objects(c.courseId)).toEqual([row.previewKey])
    expect(await h.audits(c.courseId)).toHaveLength(1)
    expect((await h.media(second)).previewFetches).toBe(1)
    expect(saved.body.course.preview.state).toBe('ready')

    const calls = h.calls().length
    const again = await h.patch(c.courseId, { previewMediaId: second, previewStartSeconds: 30 })
    expect(again.status).toBe(200)
    expect(h.calls()).toHaveLength(calls)
    expect(await h.audits(c.courseId)).toHaveLength(1)
    expect((await h.row(c.courseId)).updatedAt).toEqual(row.updatedAt)
  })

  it('cuts a start past the video to its last allowed start, and refuses one not in steps', async () => {
    const c = await h.course({ status: 'live', videos: 1 })
    expect((await h.patch(c.courseId, { previewStartSeconds: 35 })).status).toBe(400)
    expect((await h.patch(c.courseId, { previewStartSeconds: 90 })).status).toBe(200)
    expect((await h.row(c.courseId)).previewStartSeconds).toBe(90)
    expect(h.calls().at(-1)?.options.startSeconds).toBe(50)
  })

  it('keeps a draft course setting and makes no clip', async () => {
    const c = await h.course({ videos: 1 })
    const saved = await h.patch(c.courseId, { previewStartSeconds: 20 })
    expect(saved.status).toBe(200)
    expect((await h.row(c.courseId)).previewStartSeconds).toBe(20)
    expect(h.calls()).toHaveLength(0)
    expect(saved.body.course.preview.state).toBe('not_live')
  })

  it('gives no clip for a video item with no file, or a video under 5 seconds', async () => {
    const empty = await h.course({ status: 'live' })
    await t.db
      .insert(s.artefacts)
      .values({ lessonId: empty.lessonA, type: 'video', title: 'No file yet', position: 1 })
    expect(await h.previews.refresh(empty.courseId)).toBe('none')
    expect((await h.preview(empty.courseId)).state).toBe('no_video')

    const short = await h.course({ status: 'live', videos: 1, videoSeconds: 4 })
    expect(await h.previews.refresh(short.courseId)).toBe('none')
    expect((await h.preview(short.courseId)).state).toBe('no_video')
    expect(h.calls()).toHaveLength(0)
  })

  it('counts only a clip the driver returned', async () => {
    const c = await h.course({ status: 'live', videos: 1 })
    t.video.previewMode = 'null'
    expect(await h.previews.refresh(c.courseId)).toBe('failed')
    expect((await h.media(c.videos[0]?.mediaId as string)).previewFetches).toBe(0)
  })

  it('keeps the course updated_at when a refresh writes the row', async () => {
    const c = await h.course({ status: 'live', videos: 1 })
    const before = (await h.row(c.courseId)).updatedAt
    expect(await h.previews.refresh(c.courseId)).toBe('made')
    const row = await h.row(c.courseId)
    expect(row.previewKey).toBeTruthy()
    expect(row.updatedAt).toEqual(before)
  })
})

describe('the placement in an approval', () => {
  it('stores the clip before the emails, so a failed email leaves the clip', async () => {
    const c = await h.course({ status: 'pending_review', videos: 1 })
    const spy = vi.spyOn(t.mailer, 'send').mockRejectedValueOnce(new Error('mail down'))
    try {
      expect((await approve(c.courseId)).status).toBe(500)
    } finally {
      spy.mockRestore()
    }
    const row = await h.row(c.courseId)
    expect(row.status).toBe('live')
    const audits = await t.db
      .select()
      .from(s.auditLog)
      .where(and(eq(s.auditLog.entityId, c.courseId), eq(s.auditLog.action, 'course.approve')))
    expect(audits).toHaveLength(1)
    expect(row.previewKey).toBeTruthy()
    expect(t.storage.objects.has(row.previewKey as string)).toBe(true)
  })

  it('leaves the preview paragraph out when no clip was made', async () => {
    t.video.previewMode = 'null'
    const c = await h.course({ status: 'pending_review', videos: 1 })
    expect((await approve(c.courseId)).status).toBe(200)
    const mails = approvalMail(c.title)
    expect(mails.length).toBeGreaterThan(0)
    expect(mails.some((m) => m.text.includes(PREVIEW_PARAGRAPH))).toBe(false)
  })
})

describe('turning the preview off', () => {
  it('clears the key, deletes the file and hides it from the catalog', async () => {
    const c = await h.live()
    expect((await h.patch(c.courseId, { previewEnabled: false })).status).toBe(200)
    expect((await h.row(c.courseId)).previewKey).toBeNull()
    expect(t.storage.objects.has(c.key)).toBe(false)
    expect(await h.previewUrl(c)).toBeNull()
  })

  it('ignores a stale chosen video in the same request', async () => {
    const c = await h.live({ videos: 2 })
    const second = c.videos[1]?.mediaId as string
    await h.patch(c.courseId, { previewMediaId: second, previewStartSeconds: 30 })
    const del = await t.api('DELETE', h.teach(`/artefacts/${c.videos[1]?.artefactId}`), {
      token: owner,
    })
    expect(del.status).toBe(200)
    expect(h.objects(c.courseId)).toEqual([])
    expect((await h.row(c.courseId)).previewKey).toBeNull()

    const off = await h.patch(c.courseId, { previewEnabled: false, previewMediaId: second })
    expect(off.status).toBe(200)
    const row = await h.row(c.courseId)
    expect(row.previewEnabled).toBe(false)
    expect(row.previewMediaId).toBe(second)
    expect(row.previewStartSeconds).toBe(30)
  })

  it('ignores everything else in the request', async () => {
    const c = await h.live()
    const notOnCourse = await t.createVideoMedia(profileId)
    const off = await h.patch(c.courseId, { previewEnabled: false, previewMediaId: notOnCourse })
    expect(off.status).toBe(200)
    let row = await h.row(c.courseId)
    expect(row.previewKey).toBeNull()
    expect(t.storage.objects.has(c.key)).toBe(false)
    expect(row.previewMediaId).toBeNull()
    expect(row.previewStartSeconds).toBeNull()

    const other = await h.live()
    await h.patch(other.courseId, { previewStartSeconds: 20 })
    const off2 = await h.patch(other.courseId, {
      previewEnabled: false,
      previewMediaId: null,
      previewStartSeconds: null,
    })
    expect(off2.status).toBe(200)
    row = await h.row(other.courseId)
    expect(row.previewEnabled).toBe(false)
    expect(row.previewStartSeconds).toBe(20)
    expect(row.previewKey).toBeNull()
  })

  it('a tab left open cannot turn it back on', async () => {
    const c = await h.live()
    await h.patch(c.courseId, { previewEnabled: false })
    const calls = h.calls().length
    const stale = await h.patch(c.courseId, {
      previewMediaId: c.videos[0]?.mediaId,
      previewStartSeconds: 20,
    })
    expect(stale.status).toBe(200)
    const row = await h.row(c.courseId)
    expect(row.previewEnabled).toBe(false)
    expect(row.previewKey).toBeNull()
    expect(h.calls()).toHaveLength(calls)
    expect(stale.body.course.preview.state).toBe('off')
  })

  it('hides the clip when the delete fails, and the next refresh deletes it', async () => {
    const c = await h.live()
    t.storage.failDeleteKeys.add(c.key)
    const off = await h.patch(c.courseId, { previewEnabled: false })
    expect(off.status).toBe(200)
    expect(off.body.course.preview.state).toBe('off')
    expect(await h.previewUrl(c)).toBeNull()
    let row = await h.row(c.courseId)
    expect(row.previewKey).toBe(c.key)
    expect(row.previewSourceMediaId).toBeNull()
    expect(t.storage.objects.has(c.key)).toBe(true)

    t.storage.failDeleteKeys.clear()
    expect(await h.previews.refresh(c.courseId)).toBe('cleared')
    row = await h.row(c.courseId)
    expect(row.previewKey).toBeNull()
    expect(t.storage.objects.has(c.key)).toBe(false)
  })
})

describe('checks on a new choice', () => {
  it('answers 404, 400 wrong_kind, 422 and 400 as the design lists', async () => {
    const c = await h.course({ status: 'live', videos: 1 })
    const otherProfile = (await t.createProfile('other@example.com')).profile.id
    const foreign = await t.createVideoMedia(otherProfile)
    expect((await h.patch(c.courseId, { previewMediaId: foreign })).status).toBe(404)

    const [image] = await t.db
      .insert(s.mediaAssets)
      .values({
        profileId,
        kind: 'image',
        provider: 'local',
        status: 'ready',
        filename: 'cover.png',
        mimeType: 'image/png',
      })
      .returning()
    const wrongKind = await h.patch(c.courseId, { previewMediaId: image?.id })
    expect(wrongKind.status).toBe(400)
    expect(wrongKind.body.error.code).toBe('wrong_kind')

    const notOnCourse = await t.createVideoMedia(profileId)
    const refused = await h.patch(c.courseId, { previewMediaId: notOnCourse })
    expect(refused.status).toBe(422)
    expect(refused.body.error.code).toBe('preview_video_not_on_course')

    expect((await h.patch(c.courseId, { previewStartSeconds: -10 })).status).toBe(400)
  })

  it('"Make clip" with a stale choice falls back, and an empty choice clears it', async () => {
    const c = await h.live({ videos: 2 })
    const [first, second] = c.videos.map((v) => v.mediaId) as [string, string]
    await h.patch(c.courseId, { previewMediaId: second, previewStartSeconds: 30 })
    await t.api('DELETE', h.teach(`/artefacts/${c.videos[1]?.artefactId}`), { token: owner })

    const remade = await h.patch(c.courseId, { previewMediaId: second, previewStartSeconds: 30 })
    expect(remade.status).toBe(200)
    expect(h.calls().at(-1)).toEqual({
      assetId: first,
      options: expect.objectContaining({ startSeconds: 10 }),
    })
    expect(remade.body.course.preview.state).toBe('ready')

    const calls = h.calls().length
    const cleared = await h.patch(c.courseId, { previewMediaId: null, previewStartSeconds: null })
    expect(cleared.status).toBe(200)
    const row = await h.row(c.courseId)
    expect(row.previewMediaId).toBeNull()
    expect(row.previewStartSeconds).toBeNull()
    expect(h.calls()).toHaveLength(calls)
  })
})

describe('the allowance', () => {
  it('stops asking Mux at the allowance and keeps the clip that is stored', async () => {
    const c = await h.live({ videos: 2 })
    const [first, second] = c.videos.map((v) => v.mediaId) as [string, string]
    await h.setFetches(first, COURSE_PREVIEW.maxClipsPerVideo)
    const calls = h.calls().length
    const saved = await h.patch(c.courseId, { previewStartSeconds: 20 })
    expect(saved.status).toBe(200)
    expect(h.calls()).toHaveLength(calls)
    expect((await h.row(c.courseId)).previewKey).toBe(c.key)
    expect(await h.previewUrl(c)).toBeTruthy()
    const preview = saved.body.course.preview as Preview
    expect(preview.state).toBe('limit')
    expect(preview.videos.find((v) => v.mediaId === first)?.changesLeft).toBe(0)

    const picked = await h.patch(c.courseId, { previewMediaId: second })
    expect(picked.status).toBe(200)
    expect((await h.row(c.courseId)).previewSourceMediaId).toBe(second)

    const other = await h.live({ videos: 2 })
    await h.setFetches(other.videos[0]?.mediaId as string, COURSE_PREVIEW.maxClipsPerVideo)
    await h.patch(other.courseId, { previewEnabled: false })
    expect((await h.row(other.courseId)).previewKey).toBeNull()
    expect(t.storage.objects.has(other.key)).toBe(false)
  })
})

describe('a direct edit that removes the clip video', () => {
  it('deletes the clip when the previewed item is removed; "Make clip" uses the next video', async () => {
    const c = await h.live({ videos: 2 })
    const calls = h.calls().length
    const del = await t.api('DELETE', h.teach(`/artefacts/${c.videos[0]?.artefactId}`), {
      token: owner,
    })
    expect(del.status).toBe(200)
    expect(h.calls()).toHaveLength(calls)
    expect(t.storage.objects.has(c.key)).toBe(false)
    expect((await h.row(c.courseId)).previewKey).toBeNull()
    expect(await h.previewUrl(c)).toBeNull()
    const preview = del.body.course.preview as Preview
    expect(preview.state).toBe('pending')

    const made = await h.patch(c.courseId, {
      previewMediaId: preview.mediaId,
      previewStartSeconds: preview.startSeconds,
    })
    expect(made.body.course.preview.state).toBe('ready')
    expect((await h.row(c.courseId)).previewSourceMediaId).toBe(c.videos[1]?.mediaId)
  })

  it('deletes the clip when its lesson is removed', async () => {
    const c = await h.live({ videos: 2 })
    const del = await t.api('DELETE', h.teach(`/lessons/${c.lessonA}`), { token: owner })
    expect(del.status).toBe(200)
    expect(t.storage.objects.has(c.key)).toBe(false)
    expect(del.body.course.preview.state).toBe('pending')
  })

  it('deletes the clip when the item file is swapped or emptied', async () => {
    const swapped = await h.live({ videos: 2 })
    const another = await t.createVideoMedia(profileId)
    const swap = await t.api('PATCH', h.teach(`/artefacts/${swapped.videos[0]?.artefactId}`), {
      token: owner,
      body: { mediaAssetId: another },
    })
    expect(swap.status).toBe(200)
    expect(t.storage.objects.has(swapped.key)).toBe(false)
    expect(swap.body.course.preview.state).toBe('pending')

    const emptied = await h.live({ videos: 2 })
    const empty = await t.api('PATCH', h.teach(`/artefacts/${emptied.videos[0]?.artefactId}`), {
      token: owner,
      body: { mediaAssetId: null },
    })
    expect(empty.status).toBe(200)
    expect(t.storage.objects.has(emptied.key)).toBe(false)
    expect(empty.body.course.preview.state).toBe('pending')
  })

  it('leaves no clip when the only video goes', async () => {
    const c = await h.live()
    const del = await t.api('DELETE', h.teach(`/artefacts/${c.videos[0]?.artefactId}`), {
      token: owner,
    })
    expect(h.objects(c.courseId)).toEqual([])
    expect((await h.row(c.courseId)).previewKey).toBeNull()
    expect(del.body.course.preview.state).toBe('no_video')
  })

  it('keeps the clip through other edits', async () => {
    const c = await h.live()
    const url = await h.previewUrl(c)
    const added = await t.api('POST', h.teach(`/courses/${c.courseId}/lessons`), {
      token: owner,
      body: { title: 'Third lesson' },
    })
    expect(added.status).toBe(200)
    const ids = (added.body.course.lessons as Array<{ id: string }>).map((l) => l.id).reverse()
    expect(
      (
        await t.api('PUT', h.teach(`/courses/${c.courseId}/lessons/order`), {
          token: owner,
          body: { ids },
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await t.api('PATCH', h.teach(`/artefacts/${c.videos[0]?.artefactId}`), {
          token: owner,
          body: { title: 'Renamed video' },
        })
      ).status,
    ).toBe(200)
    expect((await h.row(c.courseId)).previewKey).toBe(c.key)
    expect(t.storage.objects.has(c.key)).toBe(true)
    expect(await h.previewUrl(c)).toBe(url)
  })

  it('hides the clip when the delete fails, and the next refresh deletes it', async () => {
    const c = await h.live({ videos: 2 })
    t.storage.failDeleteKeys.add(c.key)
    const del = await t.api('DELETE', h.teach(`/artefacts/${c.videos[0]?.artefactId}`), {
      token: owner,
    })
    expect(del.status).toBe(200)
    expect(await h.previewUrl(c)).toBeNull()
    let row = await h.row(c.courseId)
    expect(row.previewKey).toBe(c.key)
    expect(row.previewSourceMediaId).toBeNull()
    expect(t.storage.objects.has(c.key)).toBe(true)

    t.storage.failDeleteKeys.clear()
    await h.previews.refresh(c.courseId)
    row = await h.row(c.courseId)
    expect(t.storage.objects.has(c.key)).toBe(false)
    expect(row.previewKey).not.toBe(c.key)
  })
})

describe("a writer's change set", () => {
  const removeFirstVideo = async (c: {
    courseId: string
    videos: Array<{ artefactId: string }>
  }) => {
    const del = await t.api('DELETE', h.teach(`/artefacts/${c.videos[0]?.artefactId}`), {
      token: writer,
    })
    expect(del.status).toBe(200)
  }
  const approveChanges = (courseId: string) =>
    t.api('POST', h.teach(`/courses/${courseId}/change-set/approve`), { token: owner })

  it('keeps the clip until the removal is approved, then makes one from the next video', async () => {
    const c = await h.live({ videos: 2 })
    await removeFirstVideo(c)
    expect((await h.row(c.courseId)).previewKey).toBe(c.key)
    expect(t.storage.objects.has(c.key)).toBe(true)

    expect((await approveChanges(c.courseId)).status).toBe(200)
    expect(t.storage.objects.has(c.key)).toBe(false)
    const row = await h.row(c.courseId)
    expect(row.previewSourceMediaId).toBe(c.videos[1]?.mediaId)
    expect(t.storage.objects.has(row.previewKey as string)).toBe(true)
  })

  it('still deletes the clip when the new one cannot be made', async () => {
    // The driver fails.
    const failing = await h.live({ videos: 2 })
    await removeFirstVideo(failing)
    t.video.previewMode = 'null'
    expect((await approveChanges(failing.courseId)).status).toBe(200)
    expect(t.storage.objects.has(failing.key)).toBe(false)
    expect(await h.previewUrl(failing)).toBeNull()

    // The next video has no clip changes left.
    t.video.previewMode = 'ok'
    const spent = await h.live({ videos: 2 })
    await h.setFetches(spent.videos[1]?.mediaId as string, COURSE_PREVIEW.maxClipsPerVideo)
    await removeFirstVideo(spent)
    expect((await approveChanges(spent.courseId)).status).toBe(200)
    expect(t.storage.objects.has(spent.key)).toBe(false)
    expect(await h.previewUrl(spent)).toBeNull()
  })

  it('computes the draft view preview from the live rows', async () => {
    const c = await h.live({ videos: 2 })
    await removeFirstVideo(c)
    const preview = await h.preview(c.courseId, writer, true)
    expect(preview.videos.map((v) => v.mediaId)).toEqual(c.videos.map((v) => v.mediaId))
    expect(preview.resolved?.mediaId).toBe(c.videos[0]?.mediaId)
    expect(preview.state).toBe('ready')
  })
})

describe('refresh', () => {
  it('retires a clip whose video is no longer on the course, before a failed fetch', async () => {
    const c = await h.live()
    const elsewhere = await t.createVideoMedia(profileId)
    await t.db
      .update(s.courses)
      .set({ previewSourceMediaId: elsewhere })
      .where(eq(s.courses.id, c.courseId))
    t.video.previewMode = 'null'
    expect(await h.previews.refresh(c.courseId)).toBe('failed')
    expect(t.storage.objects.has(c.key)).toBe(false)
    expect((await h.row(c.courseId)).previewKey).toBeNull()
  })

  it('discards its clip when the video is removed while Mux answers', async () => {
    const c = await h.course({ status: 'live', videos: 1 })
    t.video.onPreview = async () => {
      await t.db.delete(s.artefacts).where(eq(s.artefacts.id, c.videos[0]?.artefactId as string))
    }
    expect(await h.previews.refresh(c.courseId)).toBe('unchanged')
    expect((await h.row(c.courseId)).previewKey).toBeNull()
    expect(h.objects(c.courseId)).toEqual([])
  })

  it('discards its clip when the setting changes while Mux answers', async () => {
    const c = await h.course({ status: 'live', videos: 1 })
    t.video.onPreview = async () => {
      await t.db
        .update(s.courses)
        .set({ previewEnabled: false })
        .where(eq(s.courses.id, c.courseId))
    }
    expect(await h.previews.refresh(c.courseId)).toBe('unchanged')
    expect((await h.row(c.courseId)).previewKey).toBeNull()
    expect(h.objects(c.courseId)).toEqual([])
  })

  it('leaves one file when two refreshes run together', async () => {
    const c = await h.course({ status: 'live', videos: 1 })
    const outcomes = await Promise.all([
      h.previews.refresh(c.courseId),
      h.previews.refresh(c.courseId),
    ])
    expect(outcomes.sort()).toEqual(['made', 'unchanged'])
    const objects = h.objects(c.courseId)
    expect(objects).toHaveLength(1)
    expect((await h.row(c.courseId)).previewKey).toBe(objects[0])
  })

  it('keeps the old clip when deleting it fails during a replacement, and retries later', async () => {
    const c = await h.live()
    t.storage.failDeleteKeys.add(c.key)
    const saved = await h.patch(c.courseId, { previewStartSeconds: 30 })
    expect(saved.status).toBe(200)
    expect(h.objects(c.courseId)).toEqual([c.key])
    let row = await h.row(c.courseId)
    expect(row.previewKey).toBe(c.key)
    expect(row.previewSourceMediaId).toBeNull()
    expect(await h.previewUrl(c)).toBeNull()
    expect(saved.body.course.preview.state).toBe('pending')

    t.storage.failDeleteKeys.clear()
    const made = await h.patch(c.courseId, { previewStartSeconds: 30 })
    expect(made.body.course.preview.state).toBe('ready')
    row = await h.row(c.courseId)
    expect(t.storage.objects.has(c.key)).toBe(false)
    expect(h.objects(c.courseId)).toEqual([row.previewKey])
    expect(row.previewSourceStartSeconds).toBe(30)
  })
})

describe('the catalog', () => {
  it('gives a plain address, the same with and without a session', async () => {
    const c = await h.live()
    const url = await h.previewUrl(c)
    expect(url).toBe(await t.storage.getUrl(c.key))
    expect(url).not.toContain('?')
    const learner = (await t.signIn('learner@example.com')).token as string
    expect(await h.previewUrl(c, learner)).toBe(url)
  })

  it('does not show a key with no source', async () => {
    const c = await h.course({ status: 'live', videos: 1 })
    await t.db
      .update(s.courses)
      .set({ previewKey: `public/previews/${c.courseId}/leftover.webp` })
      .where(eq(s.courses.id, c.courseId))
    expect(await h.previewUrl(c)).toBeNull()
  })

  it('leaves a leftover out of the count', async () => {
    const before = await h.previews.count()
    const c = await h.course({ status: 'live', videos: 1 })
    await t.db
      .update(s.courses)
      .set({ previewKey: `public/previews/${c.courseId}/leftover.webp` })
      .where(eq(s.courses.id, c.courseId))
    expect(await h.previews.count()).toEqual({ live: before.live + 1, withClip: before.withClip })
  })
})

describe('check', () => {
  it('asks for one clip, stores nothing and counts it', async () => {
    const c = await h.course({ status: 'live', videos: 1 })
    const mediaId = c.videos[0]?.mediaId as string
    const stored = t.storage.objects.size
    const result = await h.previews.check(mediaId)
    expect(result).toMatchObject({ ok: true, bytes: 8, mimeType: 'image/webp' })
    expect(t.storage.objects.size).toBe(stored)
    expect((await h.row(c.courseId)).previewKey).toBeNull()
    expect((await h.media(mediaId)).previewFetches).toBe(1)
  })

  it('is not stopped at the allowance', async () => {
    const mediaId = await t.createVideoMedia(profileId, {
      previewFetches: COURSE_PREVIEW.maxClipsPerVideo,
    })
    expect((await h.previews.check(mediaId)).ok).toBe(true)
    expect(h.calls()).toHaveLength(1)
    const fetches = (await h.media(mediaId)).previewFetches
    expect(fetches).toBe(COURSE_PREVIEW.maxClipsPerVideo + 1)
    expect(previewChangesLeft(fetches)).toBe(0)
  })

  it('reports ok: false for an image', async () => {
    const [image] = await t.db
      .insert(s.mediaAssets)
      .values({
        profileId,
        kind: 'image',
        provider: 'local',
        status: 'ready',
        filename: 'still.png',
        mimeType: 'image/png',
      })
      .returning()
    expect((await h.previews.check(image?.id as string)).ok).toBe(false)
    expect(h.calls()).toHaveLength(0)
  })
})

describe('with COURSE_PREVIEWS off', () => {
  let p: TestApp
  let pOwner: string
  let pWriter: string
  let ph: ReturnType<typeof bind>
  /** The same database and drivers with previews switched on. */
  let on: CoursePreviewService

  beforeAll(async () => {
    p = await createTestApp({ COURSE_PREVIEWS: 'false' })
    const id = (await p.createProfile('paused@example.com', { payable: true })).profile.id
    await p.addMember(id, 'paused-writer@example.com', 'writer')
    await p.grantRole('paused-agent@example.com', 'support_agent')
    pOwner = (await p.signIn('paused@example.com', 'teach')).token as string
    pWriter = (await p.signIn('paused-writer@example.com', 'teach')).token as string
    ph = bind(p, id, pOwner)
    on = new CoursePreviewService({ ...p.deps, env: { ...p.deps.env, COURSE_PREVIEWS: true } })
  })
  afterAll(async () => {
    await p.close()
  })
  beforeEach(() => reset(p))

  /** A live course with a clip made while previews were on. */
  async function pausedWithClip(videos: 1 | 2 = 1) {
    const c = await ph.course({ status: 'live', videos })
    expect(await on.refresh(c.courseId)).toBe('made')
    return { ...c, key: (await ph.row(c.courseId)).previewKey as string }
  }

  it('approval makes no clip, and a stored key gives no address', async () => {
    const agent = (await p.signIn('paused-agent@example.com', 'support')).token as string
    const c = await ph.course({ status: 'pending_review', videos: 1 })
    expect(
      (await p.api('POST', `/api/support/courses/${c.courseId}/approve`, { token: agent })).status,
    ).toBe(200)
    expect(p.video.previewCalls).toHaveLength(0)
    expect((await ph.preview(c.courseId)).state).toBe('paused')

    const direct = await ph.course({ status: 'live', videos: 1 })
    await p.db
      .update(s.courses)
      .set({
        previewKey: `public/previews/${direct.courseId}/x.webp`,
        previewSourceMediaId: direct.videos[0]?.mediaId,
        previewSourceStartSeconds: 10,
      })
      .where(eq(s.courses.id, direct.courseId))
    expect(await ph.previewUrl(direct)).toBeNull()
  })

  it('keeps a stored clip through the pause, and shows it again when switched on', async () => {
    const c = await pausedWithClip()
    expect(await ph.previews.refresh(c.courseId)).toBe('paused')
    expect((await ph.row(c.courseId)).previewKey).toBe(c.key)
    const served = await p.app.request(`/api/files/${c.key}`)
    expect(served.status).toBe(200)
    expect(await ph.previewUrl(c)).toBeNull()

    const switchedOn = createApp({ ...p.deps, env: { ...p.deps.env, COURSE_PREVIEWS: true } })
    const list = await switchedOn.request(`/api/catalog/courses?q=${encodeURIComponent(c.title)}`)
    const body = (await list.json()) as { items: Array<{ id: string; previewUrl: string | null }> }
    expect(body.items.find((i) => i.id === c.courseId)?.previewUrl).toBe(
      await p.storage.getUrl(c.key),
    )
  })

  it('still deletes the clip when the preview is turned off', async () => {
    const c = await pausedWithClip()
    expect((await ph.patch(c.courseId, { previewEnabled: false })).status).toBe(200)
    expect((await ph.row(c.courseId)).previewKey).toBeNull()
    expect(p.storage.objects.has(c.key)).toBe(false)
  })

  it('still retires a clip after a direct edit removes its video', async () => {
    const c = await pausedWithClip()
    await p.api('DELETE', ph.teach(`/artefacts/${c.videos[0]?.artefactId}`), { token: pOwner })
    expect(p.storage.objects.has(c.key)).toBe(false)
  })

  it("still deletes the clip when a writer's removal is approved", async () => {
    const c = await pausedWithClip(2)
    await p.api('DELETE', ph.teach(`/artefacts/${c.videos[0]?.artefactId}`), { token: pWriter })
    expect(
      (
        await p.api('POST', ph.teach(`/courses/${c.courseId}/change-set/approve`), {
          token: pOwner,
        })
      ).status,
    ).toBe(200)
    expect(p.storage.objects.has(c.key)).toBe(false)
    expect(await ph.previewUrl(c)).toBeNull()
  })

  it('cleans up a leftover before it stops', async () => {
    const c = await pausedWithClip()
    await p.db
      .update(s.courses)
      .set({ previewSourceMediaId: null, previewSourceStartSeconds: null })
      .where(eq(s.courses.id, c.courseId))
    expect(await ph.previews.refresh(c.courseId)).toBe('paused')
    expect((await ph.row(c.courseId)).previewKey).toBeNull()
    expect(p.storage.objects.has(c.key)).toBe(false)
  })
})

describe('backfill and count', () => {
  it('makes the missing clips, leaves the rest, and counts them', async () => {
    const b = await createTestApp()
    try {
      const id = (await b.createProfile('backfill@example.com')).profile.id
      const bh = bind(b, id, '')
      await bh.course({ status: 'live', videos: 1 })
      await bh.course({ status: 'live', videos: 1 })
      await bh.live()
      await bh.course({ videos: 1 })
      const calls = b.video.previewCalls.length

      const first = await bh.previews.backfill()
      expect(first).toMatchObject({ made: 2, unchanged: 1, not_live: 0, failed: 0 })
      expect(b.video.previewCalls.length).toBe(calls + 2)
      expect(await bh.previews.count()).toEqual({ live: 3, withClip: 3 })

      const second = await bh.previews.backfill()
      expect(second).toMatchObject({ made: 0, unchanged: 3 })
      expect(b.video.previewCalls.length).toBe(calls + 2)
    } finally {
      await b.close()
    }
  })
})
