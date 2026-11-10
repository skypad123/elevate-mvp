import {
  assertSafeKey,
  isPublicKey,
  type StorageProvider,
  type StoredObject,
  type UploadTarget,
} from './types'

/** In-memory storage for tests. */
export class FakeStorage implements StorageProvider {
  readonly driver = 'fake'
  readonly objects = new Map<string, { body: Uint8Array; mimeType: string }>()
  constructor(private readonly apiUrl = 'http://api.test') {}

  async createUploadTarget(input: {
    assetId: string
    key: string
    mimeType: string
  }): Promise<UploadTarget> {
    assertSafeKey(input.key)
    return { url: `${this.apiUrl}/fake-upload/${input.assetId}`, method: 'PUT' }
  }
  async put(key: string, body: Uint8Array, mimeType: string): Promise<void> {
    assertSafeKey(key)
    this.objects.set(key, { body, mimeType })
  }
  async putStream(
    key: string,
    body: ReadableStream<Uint8Array>,
    mimeType: string,
  ): Promise<{ size: number }> {
    const bytes = new Uint8Array(await new Response(body).arrayBuffer())
    await this.put(key, bytes, mimeType)
    return { size: bytes.byteLength }
  }
  async get(key: string): Promise<StoredObject | null> {
    const obj = this.objects.get(key)
    if (!obj) return null
    return {
      // The cast keeps this compiling whether `Response` comes from undici (Node types) or lib.dom
      // (pulled in by vitest's optional jsdom types once @types/jsdom is installed).
      body: new Response(obj.body as Uint8Array<ArrayBuffer>).body as ReadableStream<Uint8Array>,
      size: obj.body.byteLength,
      mimeType: obj.mimeType,
    }
  }
  async head(key: string): Promise<{ size: number } | null> {
    const obj = this.objects.get(key)
    return obj ? { size: obj.body.byteLength } : null
  }
  async delete(key: string): Promise<void> {
    this.objects.delete(key)
  }
  async getUrl(key: string): Promise<string> {
    return isPublicKey(key)
      ? `${this.apiUrl}/api/files/${key}`
      : `${this.apiUrl}/api/files/${key}?sig=fake`
  }
}
