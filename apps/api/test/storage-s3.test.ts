import { S3Client } from '@aws-sdk/client-s3'
import { describe, expect, it, vi } from 'vitest'
import { loadEnv } from '../src/env'
import { createStorage, S3Storage } from '../src/providers/storage'

const client = () =>
  new S3Client({
    region: 'ap-southeast-1',
    credentials: { accessKeyId: 'AKIATEST', secretAccessKey: 'secret' },
  })

const storage = (c = client(), publicBaseUrl?: string) =>
  new S3Storage({ client: c, bucket: 'elevate-test', apiUrl: 'https://api.test/', publicBaseUrl })

describe('S3Storage', () => {
  it('presigns a PUT for browser uploads without pinning the content type', async () => {
    const target = await storage().createUploadTarget({
      assetId: 'a1',
      key: 'audio/a1.mp3',
      mimeType: 'audio/mpeg',
    })
    const url = new URL(target.url)
    expect(target.method).toBe('PUT')
    expect(url.hostname).toBe('elevate-test.s3.ap-southeast-1.amazonaws.com')
    expect(url.pathname).toBe('/audio/a1.mp3')
    expect(url.searchParams.get('X-Amz-Expires')).toBe('3600')
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('host')
    expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy()
  })

  it('serves public keys through the API, or a CDN when one is configured', async () => {
    expect(await storage().getUrl('public/images/x.png')).toBe(
      'https://api.test/api/files/public/images/x.png',
    )
    expect(await storage(client(), 'https://cdn.test/').getUrl('public/images/x.png')).toBe(
      'https://cdn.test/public/images/x.png',
    )
  })

  it('presigns private reads with the requested lifetime', async () => {
    const url = new URL(await storage().getUrl('certificates/c1.pdf', 900))
    expect(url.pathname).toBe('/certificates/c1.pdf')
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900')
    expect(url.searchParams.get('response-content-type')).toBe('application/pdf')
  })

  it('rejects unsafe keys before talking to S3', async () => {
    const c = client()
    const send = vi.spyOn(c, 'send')
    await expect(storage(c).get('../etc/passwd')).rejects.toThrow('unsafe storage key')
    expect(send).not.toHaveBeenCalled()
  })

  it('maps a missing object to null and rethrows other failures', async () => {
    const c = client()
    const send = vi.spyOn(c, 'send') as unknown as ReturnType<typeof vi.fn>
    send.mockRejectedValueOnce(Object.assign(new Error('nope'), { name: 'NotFound' }))
    expect(await storage(c).head('audio/missing.mp3')).toBeNull()
    send.mockRejectedValueOnce(Object.assign(new Error('nope'), { name: 'NoSuchKey' }))
    expect(await storage(c).get('audio/missing.mp3')).toBeNull()
    send.mockRejectedValueOnce(Object.assign(new Error('denied'), { name: 'AccessDenied' }))
    await expect(storage(c).head('audio/a.mp3')).rejects.toThrow('denied')
  })

  it('reports size from head and sends the content type on put', async () => {
    const c = client()
    const send = vi.spyOn(c, 'send') as unknown as ReturnType<typeof vi.fn>
    send.mockResolvedValueOnce({ ContentLength: 42 })
    expect(await storage(c).head('audio/a.mp3')).toEqual({ size: 42 })
    send.mockResolvedValueOnce({})
    await storage(c).put('certificates/c1.pdf', new Uint8Array([1]), 'application/pdf')
    expect(send.mock.calls[1]?.[0].input).toMatchObject({
      Bucket: 'elevate-test',
      Key: 'certificates/c1.pdf',
      ContentType: 'application/pdf',
    })
  })
})

describe('createStorage', () => {
  const base = { DATABASE_URL: 'postgres://x', SESSION_SECRET: 'x'.repeat(32) }

  it('builds the S3 driver from env without static keys', () => {
    const env = loadEnv({ ...base, STORAGE_DRIVER: 's3', S3_BUCKET: 'b', S3_REGION: 'us-east-1' })
    expect(createStorage(env).driver).toBe('s3')
  })

  it('requires a bucket', () => {
    const env = loadEnv({ ...base, STORAGE_DRIVER: 's3' })
    expect(() => createStorage(env)).toThrow('S3_BUCKET')
  })
})
