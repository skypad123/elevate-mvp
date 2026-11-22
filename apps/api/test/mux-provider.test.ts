import { generateKeyPairSync } from 'node:crypto'
import { COURSE_PREVIEW } from '@elevate/core'
import { describe, expect, it } from 'vitest'
import { type MediaAssetRow, MuxVideoProvider } from '../src/providers/video'

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

const asset = (overrides: Partial<MediaAssetRow> = {}): MediaAssetRow => ({
  id: '00000000-0000-4000-8000-000000000001',
  uploaderId: null,
  profileId: null,
  kind: 'video',
  provider: 'mux',
  status: 'ready',
  providerUploadId: null,
  providerAssetId: 'ast_1',
  playbackId: 'pb_test',
  storageKey: null,
  filename: 'lesson.mp4',
  mimeType: 'video/mp4',
  sizeBytes: null,
  durationSeconds: 60,
  previewFetches: 0,
  width: null,
  height: null,
  errorMessage: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const options = { startSeconds: 10, endSeconds: 14, width: 480, fps: 10 }
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 9, 9, 9, 9])

type Call = { url: string; init: RequestInit | undefined }

/** A driver whose `fetch` is the given stub, and the calls made to it. */
function driver(respond: (call: Call) => Promise<Response>) {
  const calls: Call[] = []
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(input), init }
    calls.push(call)
    return respond(call)
  }) as typeof fetch
  const provider = new MuxVideoProvider(
    {
      tokenId: 'id',
      tokenSecret: 'secret',
      signingKeyId: 'key_1',
      signingPrivateKey: pem,
      testMode: true,
    },
    fetchImpl,
  )
  return { provider, calls }
}

const ok = () =>
  Promise.resolve(new Response(webp, { status: 200, headers: { 'content-type': 'image/webp' } }))

const payloadOf = (token: string) =>
  JSON.parse(Buffer.from(token.split('.')[1] as string, 'base64url').toString('utf8'))

describe('MuxVideoProvider.animatedPreview', () => {
  it('asks image.mux.com for animated.webp with only a token', async () => {
    const { provider, calls } = driver(ok)
    await provider.animatedPreview(asset(), options)
    const url = new URL(calls[0]?.url as string)
    expect(`${url.origin}${url.pathname}`).toBe('https://image.mux.com/pb_test/animated.webp')
    expect([...url.searchParams.keys()]).toEqual(['token'])
    expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('signs a gif token with the clip options as strings', async () => {
    const { provider, calls } = driver(ok)
    await provider.animatedPreview(asset(), options)
    const token = new URL(calls[0]?.url as string).searchParams.get('token') as string
    const payload = payloadOf(token)
    expect(payload).toMatchObject({
      aud: 'g',
      sub: 'pb_test',
      start: '10',
      end: '14',
      width: '480',
      fps: '10',
    })
  })

  it('returns the bytes of a 200 image/webp answer', async () => {
    const { provider } = driver(() =>
      Promise.resolve(
        new Response(webp, {
          status: 200,
          headers: { 'content-type': 'Image/WebP; charset=binary' },
        }),
      ),
    )
    const clip = await provider.animatedPreview(asset(), options)
    expect(clip?.mimeType).toBe('image/webp')
    expect([...(clip?.bytes ?? [])]).toEqual([...webp])
  })

  it('returns null for a refusal with a JSON body', async () => {
    const { provider } = driver(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { messages: ['Invalid start time'] } }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
    expect(await provider.animatedPreview(asset(), options)).toBeNull()
  })

  it('returns null for a 200 that is not WebP', async () => {
    const { provider } = driver(() =>
      Promise.resolve(
        new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
      ),
    )
    expect(await provider.animatedPreview(asset(), options)).toBeNull()
  })

  it('returns null for a Content-Length over the cap, without reading the body', async () => {
    let pulled = false
    // A high-water mark of 0, so the stream is pulled only when something reads it.
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulled = true
          controller.enqueue(webp)
          controller.close()
        },
      },
      { highWaterMark: 0 },
    )
    const { provider } = driver(() =>
      Promise.resolve(
        new Response(body, {
          status: 200,
          headers: {
            'content-type': 'image/webp',
            'content-length': String(COURSE_PREVIEW.maxBytes + 1),
          },
        }),
      ),
    )
    expect(await provider.animatedPreview(asset(), options)).toBeNull()
    expect(pulled).toBe(false)
  })

  it('returns null for a body over the cap with no Content-Length', async () => {
    const chunk = new Uint8Array(1_000_000)
    let sent = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent > COURSE_PREVIEW.maxBytes) return controller.close()
        sent += chunk.byteLength
        controller.enqueue(chunk)
      },
    })
    const { provider } = driver(() =>
      Promise.resolve(
        new Response(body, { status: 200, headers: { 'content-type': 'image/webp' } }),
      ),
    )
    expect(await provider.animatedPreview(asset(), options)).toBeNull()
  })

  it('returns null when fetch rejects', async () => {
    const { provider } = driver(() => Promise.reject(new TypeError('fetch failed')))
    expect(await provider.animatedPreview(asset(), options)).toBeNull()
  })

  it('returns null when fetch times out', async () => {
    const { provider } = driver(() =>
      Promise.reject(new DOMException('The operation was aborted due to timeout', 'TimeoutError')),
    )
    expect(await provider.animatedPreview(asset(), options)).toBeNull()
  })

  it('returns null, asking nothing, for an asset with no playback ID', async () => {
    const { provider, calls } = driver(ok)
    expect(await provider.animatedPreview(asset({ playbackId: null }), options)).toBeNull()
    expect(calls).toHaveLength(0)
  })
})
