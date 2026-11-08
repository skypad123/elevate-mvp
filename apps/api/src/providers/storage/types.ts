export type UploadTarget = { url: string; method: 'PUT'; headers?: Record<string, string> }

export type StoredObject = {
  body: ReadableStream<Uint8Array>
  size: number
  mimeType: string
}

/**
 * Object storage for audio, images, documents and certificate PDFs.
 * Keys under `public/` are world-readable (course thumbnails, avatars); everything else is
 * served through short-lived signed URLs.
 */
export interface StorageProvider {
  readonly driver: 'local' | 's3' | 'fake'
  createUploadTarget(input: {
    assetId: string
    key: string
    mimeType: string
    sizeBytes: number
  }): Promise<UploadTarget>
  put(key: string, body: Uint8Array, mimeType: string): Promise<void>
  putStream(
    key: string,
    body: ReadableStream<Uint8Array>,
    mimeType: string,
  ): Promise<{ size: number }>
  get(key: string): Promise<StoredObject | null>
  head(key: string): Promise<{ size: number } | null>
  delete(key: string): Promise<void>
  getUrl(key: string, ttlSeconds?: number): Promise<string>
}

export const isPublicKey = (key: string) => key.startsWith('public/')

const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9/_.-]{0,511}$/

export function assertSafeKey(key: string): void {
  if (!SAFE_KEY.test(key) || key.includes('..') || key.includes('//')) {
    throw new Error(`unsafe storage key: ${key}`)
  }
}

export const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  gif: 'image/gif',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  m4v: 'video/x-m4v',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  json: 'application/json',
  bin: 'application/octet-stream',
}

export const EXT_BY_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_BY_EXT)
    .filter(([ext]) => !['jpeg', 'bin'].includes(ext))
    .map(([ext, mime]) => [mime, ext]),
)

export function mimeFromKey(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

export function extensionFor(mimeType: string, filename: string): string {
  const fromMime = EXT_BY_MIME[mimeType]
  if (fromMime) return fromMime
  const fromName = filename.split('.').pop()?.toLowerCase()
  return fromName && /^[a-z0-9]{1,5}$/.test(fromName) ? fromName : 'bin'
}
