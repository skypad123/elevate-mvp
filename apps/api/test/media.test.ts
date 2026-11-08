import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

let t: TestApp
let token: string
beforeAll(async () => {
  t = await createTestApp()
  token = (await t.signIn('uploader@example.com')).token as string
})
afterAll(async () => {
  await t.close()
})

describe('media uploads', () => {
  it('creates an image upload, completes it, and exposes a public url', async () => {
    const created = await t.api('POST', '/api/media/uploads', {
      token,
      body: { kind: 'image', filename: 'cover.png', mimeType: 'image/png', sizeBytes: 1234 },
    })
    expect(created.status).toBe(200)
    expect(created.body.mode).toBe('put')
    expect(created.body.asset.status).toBe('pending')
    expect(created.body.asset.url).toBeNull()

    const key = `public/images/${created.body.asset.id}`
    // simulate the PUT by writing straight into fake storage under the asset's key
    const row = await t.db.query.mediaAssets.findFirst({
      where: (m, { eq }) => eq(m.id, created.body.asset.id),
    })
    expect(row?.storageKey?.startsWith('public/images/')).toBe(true)
    await t.storage.put(row?.storageKey as string, new Uint8Array([1, 2, 3]), 'image/png')

    const completed = await t.api('POST', `/api/media/assets/${created.body.asset.id}/complete`, {
      token,
    })
    expect(completed.status).toBe(200)
    expect(completed.body.asset.status).toBe('ready')
    expect(completed.body.asset.url).toContain('/api/files/public/images/')
    expect(key).toBeTruthy()

    const served = await t.app.request(`/api/files/${row?.storageKey}`)
    expect(served.status).toBe(200)
    expect(served.headers.get('content-type')).toBe('image/png')
  })

  it('rejects unsupported types and non-owners', async () => {
    const bad = await t.api('POST', '/api/media/uploads', {
      token,
      body: {
        kind: 'image',
        filename: 'x.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 10,
      },
    })
    expect(bad.status).toBe(400)

    const created = await t.api('POST', '/api/media/uploads', {
      token,
      body: { kind: 'document', filename: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 10 },
    })
    const other = (await t.signIn('other@example.com')).token as string
    const denied = await t.api('GET', `/api/media/assets/${created.body.asset.id}`, {
      token: other,
    })
    expect(denied.status).toBe(403)
    const incomplete = await t.api('POST', `/api/media/assets/${created.body.asset.id}/complete`, {
      token,
    })
    expect(incomplete.status).toBe(409)
  })
})
