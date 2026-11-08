import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

let t: TestApp
let token: string
beforeAll(async () => {
  t = await createTestApp()
  token = (await t.signIn('teacher-video@example.com')).token as string
})
afterAll(async () => {
  await t.close()
})

const muxPost = (event: unknown, signature = 'fake-valid') =>
  t.app.request('/api/webhooks/mux', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'mux-signature': signature },
    body: JSON.stringify(event),
  })

describe('video uploads through the video provider', () => {
  it('creates a provider upload, tolerates out-of-order webhooks, dedupes replays, and signs playback', async () => {
    const created = await t.api('POST', '/api/media/uploads', {
      token,
      body: { kind: 'video', filename: 'lesson.mp4', mimeType: 'video/mp4', sizeBytes: 50_000_000 },
    })
    expect(created.status).toBe(200)
    expect(created.body.mode).toBe('mux')
    expect(created.body.uploadUrl).toContain('fake-mux')
    expect(created.body.asset.provider).toBe('mux')
    expect(created.body.asset.status).toBe('pending')

    const uploadId = [...t.video.uploads.keys()].at(-1) as string
    const events = t.video.eventsFor(uploadId, { duration: 125.4 })

    // asset.ready arrives before upload.asset_created
    const ready = await muxPost(events.ready)
    expect(ready.status).toBe(200)
    expect(await ready.json()).toMatchObject({ received: true, outcome: 'applied' })
    let asset = await t.api('GET', `/api/media/assets/${created.body.asset.id}`, { token })
    expect(asset.body.asset.status).toBe('ready')
    expect(asset.body.asset.durationSeconds).toBe(125)

    const late = await muxPost(events.created)
    expect(await late.json()).toMatchObject({ outcome: 'ignored' })
    asset = await t.api('GET', `/api/media/assets/${created.body.asset.id}`, { token })
    expect(asset.body.asset.status).toBe('ready')

    const replay = await muxPost(events.ready)
    expect(await replay.json()).toMatchObject({ received: true, duplicate: true })

    const playback = await t.api('GET', `/api/media/assets/${created.body.asset.id}/playback`, {
      token,
    })
    expect(playback.status).toBe(200)
    expect(playback.body.playback).toMatchObject({
      kind: 'video',
      provider: 'mux',
      playbackId: `pb_${uploadId}`,
    })
    expect(playback.body.playback.hlsUrl).toContain('.m3u8?token=')

    const stranger = (await t.signIn('stranger@example.com')).token as string
    expect(
      (
        await t.api('GET', `/api/media/assets/${created.body.asset.id}/playback`, {
          token: stranger,
        })
      ).status,
    ).toBe(403)
  })

  it('rejects bad signatures and records errored assets', async () => {
    const created = await t.api('POST', '/api/media/uploads', {
      token,
      body: { kind: 'video', filename: 'broken.mov', mimeType: 'video/quicktime', sizeBytes: 1000 },
    })
    const uploadId = [...t.video.uploads.keys()].at(-1) as string
    const bad = await muxPost(t.video.eventsFor(uploadId).ready, 'nope')
    expect(bad.status).toBe(400)

    const errored = await muxPost({
      id: `evt_err_${uploadId}`,
      type: 'video.upload.errored',
      data: { id: uploadId },
    })
    expect(await errored.json()).toMatchObject({ outcome: 'applied' })
    const asset = await t.api('GET', `/api/media/assets/${created.body.asset.id}`, { token })
    expect(asset.body.asset.status).toBe('errored')
    expect(
      (await t.api('GET', `/api/media/assets/${created.body.asset.id}/playback`, { token })).status,
    ).toBe(409)

    const unmatched = await muxPost({
      id: 'evt_zzz',
      type: 'video.asset.ready',
      data: { id: 'ast_unknown', playback_ids: [] },
    })
    expect(await unmatched.json()).toMatchObject({ outcome: 'unmatched' })
  })

  it('serves audio through storage with a signed playback url', async () => {
    const created = await t.api('POST', '/api/media/uploads', {
      token,
      body: { kind: 'audio', filename: 'talk.mp3', mimeType: 'audio/mpeg', sizeBytes: 1000 },
    })
    expect(created.body.mode).toBe('put')
    const row = await t.db.query.mediaAssets.findFirst({
      where: (m, { eq }) => eq(m.id, created.body.asset.id),
    })
    await t.storage.put(row?.storageKey as string, new Uint8Array([1, 2, 3]), 'audio/mpeg')
    await t.api('POST', `/api/media/assets/${created.body.asset.id}/complete`, { token })
    const playback = await t.api('GET', `/api/media/assets/${created.body.asset.id}/playback`, {
      token,
    })
    expect(playback.body.playback).toMatchObject({ kind: 'audio' })
    expect(playback.body.playback.url).toContain('/api/files/audio/')
  })
})
