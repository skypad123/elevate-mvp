import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * Goal 12: course media belongs to the profile. Whoever is on the profile can use it, whoever
 * uploaded it; someone who has left cannot; and it cannot be put on another profile's course.
 */
let t: TestApp
let profileId: string
let owner: string
let writer: string

const teach = (path: string, profile = profileId) => `/api/teach/profiles/${profile}${path}`

/** Uploads a file and finishes the upload, the way the browser does. */
async function upload(
  token: string,
  file: { kind: 'image' | 'audio'; filename: string; mimeType: string },
  to?: string,
) {
  const created = await t.api('POST', '/api/media/uploads', {
    token,
    body: { ...file, sizeBytes: 10, ...(to ? { profileId: to } : {}) },
  })
  if (created.status !== 200) return { status: created.status, id: '' }
  const id = created.body.asset.id as string
  const row = await t.db.query.mediaAssets.findFirst({ where: { id } })
  await t.storage.put(row?.storageKey as string, new Uint8Array([1]), file.mimeType)
  const completed = await t.api('POST', `/api/media/assets/${id}/complete`, { token })
  return { status: completed.status, id }
}

const cover = { kind: 'image', filename: 'cover.png', mimeType: 'image/png' } as const
const voice = { kind: 'audio', filename: 'voice.mp3', mimeType: 'audio/mpeg' } as const

beforeAll(async () => {
  t = await createTestApp()
  profileId = (await t.createProfile('owner@example.com')).profile.id
  await t.addMember(profileId, 'writer@example.com', 'writer')
  owner = (await t.signIn('owner@example.com', 'teach')).token as string
  writer = (await t.signIn('writer@example.com', 'teach')).token as string
})
afterAll(async () => {
  await t.close()
})

describe('course media', () => {
  it('stays with the profile when the writer who uploaded it is removed', async () => {
    const course = await t.createCourse(profileId)
    const image = await upload(writer, cover, profileId)
    const audio = await upload(writer, voice, profileId)
    expect([image.status, audio.status]).toEqual([200, 200])

    // the owner uses the writer's files: a thumbnail, and the sound of an audio artefact
    const thumbnail = await t.api('PATCH', teach(`/courses/${course.courseId}`), {
      token: owner,
      body: { thumbnailMediaId: image.id },
    })
    expect(thumbnail.status).toBe(200)
    const added = await t.api('POST', teach(`/lessons/${course.lessonA}/artefacts`), {
      token: owner,
      body: { type: 'audio', title: 'Listen' },
    })
    const artefact = added.body.course.lessons[0].artefacts.find(
      (a: { title: string }) => a.title === 'Listen',
    )
    const attached = await t.api('PATCH', teach(`/artefacts/${artefact.id}`), {
      token: owner,
      body: { mediaAssetId: audio.id },
    })
    expect(attached.status).toBe(200)
    expect(
      (await t.api('GET', `/api/media/assets/${audio.id}/playback`, { token: writer })).status,
    ).toBe(200)

    // the owner removes the writer
    const writerRow = await t.db.query.users.findFirst({ where: { email: 'writer@example.com' } })
    const removed = await t.api('DELETE', teach(`/members/${writerRow?.id}`), { token: owner })
    expect(removed.status).toBe(200)

    // the files are still the profile's, and still on the course
    const row = await t.db.query.mediaAssets.findFirst({ where: { id: audio.id } })
    expect(row).toMatchObject({ profileId, uploaderId: writerRow?.id })
    for (const id of [image.id, audio.id]) {
      expect((await t.api('GET', `/api/media/assets/${id}`, { token: owner })).status).toBe(200)
    }
    expect(
      (await t.api('GET', `/api/media/assets/${audio.id}/playback`, { token: owner })).status,
    ).toBe(200)
    const view = await t.api('GET', teach(`/courses/${course.courseId}`), { token: owner })
    expect(view.body.course.thumbnail).toMatchObject({ id: image.id, status: 'ready' })
    expect(
      view.body.course.lessons[0].artefacts.find((a: { id: string }) => a.id === artefact.id).media,
    ).toMatchObject({ id: audio.id })
    // the owner can put them on another of the profile's courses
    const second = await t.createCourse(profileId)
    const reused = await t.api('PATCH', teach(`/courses/${second.courseId}`), {
      token: owner,
      body: { thumbnailMediaId: image.id },
    })
    expect(reused.status).toBe(200)

    // the writer who left has no way back to them
    for (const path of [
      `/api/media/assets/${image.id}`,
      `/api/media/assets/${audio.id}/playback`,
    ]) {
      expect((await t.api('GET', path, { token: writer })).status, path).toBe(403)
    }
  })

  it('cannot be put on another profile course, even by someone who is on both profiles', async () => {
    // "both" writes for the first profile and owns a second one
    await t.addMember(profileId, 'both@example.com', 'writer')
    const second = (await t.createProfile('both@example.com')).profile.id
    const both = (await t.signIn('both@example.com', 'teach')).token as string
    const theirs = await upload(owner, cover, profileId)
    // as a writer on the first profile they may read its media
    expect((await t.api('GET', `/api/media/assets/${theirs.id}`, { token: both })).status).toBe(200)

    const course = await t.createCourse(second)
    const crossed = await t.api('PATCH', teach(`/courses/${course.courseId}`, second), {
      token: both,
      body: { thumbnailMediaId: theirs.id },
    })
    expect(crossed.status).toBe(404)
    const sound = await upload(owner, voice, profileId)
    const added = await t.api('POST', teach(`/lessons/${course.lessonA}/artefacts`, second), {
      token: both,
      body: { type: 'audio', title: 'Borrowed' },
    })
    const artefact = added.body.course.lessons[0].artefacts.find(
      (a: { title: string }) => a.title === 'Borrowed',
    )
    const borrowed = await t.api('PATCH', teach(`/artefacts/${artefact.id}`, second), {
      token: both,
      body: { mediaAssetId: sound.id },
    })
    expect(borrowed.status).toBe(404)

    // nor can it become the second profile's picture
    const picture = await t.api('PATCH', teach('/profile', second), {
      token: both,
      body: { avatarMediaId: theirs.id },
    })
    expect(picture.status).toBe(404)

    // a file uploaded to no profile is the uploader's own, and cannot go on a course either
    const personal = await upload(both, cover)
    const own = await t.api('PATCH', teach(`/courses/${course.courseId}`, second), {
      token: both,
      body: { thumbnailMediaId: personal.id },
    })
    expect(own.status).toBe(404)
    // uploaded to the second profile, it can
    const mine = await upload(both, cover, second)
    const fine = await t.api('PATCH', teach(`/courses/${course.courseId}`, second), {
      token: both,
      body: { thumbnailMediaId: mine.id },
    })
    expect(fine.status).toBe(200)
    const ownPicture = await t.api('PATCH', teach('/profile', second), {
      token: both,
      body: { avatarMediaId: mine.id },
    })
    expect(ownPicture.status).toBe(200)
    expect(ownPicture.body.profile.avatarUrl).toContain('/api/files/public/')
  })

  it('cannot be uploaded to a profile the caller is not on', async () => {
    const stranger = (await t.signIn('stranger@example.com', 'teach')).token as string
    expect((await upload(stranger, cover, profileId)).status).toBe(404)
    // and their own upload stays out of everyone else's reach
    const own = await upload(stranger, cover)
    expect((await t.api('GET', `/api/media/assets/${own.id}`, { token: owner })).status).toBe(403)
  })
})
