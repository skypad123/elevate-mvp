import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { signExpiring, verifyExpiring } from '../../lib/crypto'
import { currentRequestOrigin } from '../../lib/request-context'
import {
  assertSafeKey,
  isPublicKey,
  mimeFromKey,
  type StorageProvider,
  type StoredObject,
  type UploadTarget,
} from './types'

const DEFAULT_TTL = 2 * 60 * 60

/**
 * Dev driver: files live under `rootDir`, uploads are a plain HTTP PUT to the API, and private
 * files are served through HMAC-signed URLs on `/api/files/*`.
 */
export class LocalDiskStorage implements StorageProvider {
  readonly driver = 'local'
  constructor(
    private readonly rootDir: string,
    private readonly apiUrl: string,
    private readonly secret: string,
    /** Dev: build URLs from the origin the client used, so phones on the LAN can fetch files. */
    private readonly useRequestOrigin = false,
  ) {}

  private base(): string {
    return (this.useRequestOrigin ? currentRequestOrigin() : null) ?? this.apiUrl
  }

  private pathFor(key: string) {
    assertSafeKey(key)
    return join(this.rootDir, key)
  }

  async createUploadTarget(input: {
    assetId: string
    key: string
    mimeType: string
  }): Promise<UploadTarget> {
    assertSafeKey(input.key)
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60
    const sig = signExpiring(this.secret, 'upload', input.assetId, expiresAt)
    return {
      url: `${this.base()}/api/media/uploads/${input.assetId}/file?exp=${expiresAt}&sig=${sig}`,
      method: 'PUT',
      headers: { 'Content-Type': input.mimeType },
    }
  }

  verifyUploadSignature(
    assetId: string,
    exp: string | undefined,
    sig: string | undefined,
  ): boolean {
    return !!exp && !!sig && verifyExpiring(this.secret, 'upload', assetId, Number(exp), sig)
  }

  verifyFileSignature(key: string, exp: string | undefined, sig: string | undefined): boolean {
    return !!exp && !!sig && verifyExpiring(this.secret, 'file', key, Number(exp), sig)
  }

  async put(key: string, body: Uint8Array): Promise<void> {
    const path = this.pathFor(key)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, body)
  }

  async putStream(key: string, body: ReadableStream<Uint8Array>): Promise<{ size: number }> {
    const path = this.pathFor(key)
    await mkdir(dirname(path), { recursive: true })
    await pipeline(Readable.fromWeb(body as never), createWriteStream(path))
    const info = await stat(path)
    return { size: info.size }
  }

  async get(key: string): Promise<StoredObject | null> {
    const path = this.pathFor(key)
    const info = await stat(path).catch(() => null)
    if (!info?.isFile()) return null
    return {
      body: Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>,
      size: info.size,
      mimeType: mimeFromKey(key),
    }
  }

  async head(key: string): Promise<{ size: number } | null> {
    const info = await stat(this.pathFor(key)).catch(() => null)
    return info?.isFile() ? { size: info.size } : null
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true })
  }

  async getUrl(key: string, ttlSeconds = DEFAULT_TTL): Promise<string> {
    assertSafeKey(key)
    if (isPublicKey(key)) return `${this.base()}/api/files/${key}`
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds
    const sig = signExpiring(this.secret, 'file', key, expiresAt)
    return `${this.base()}/api/files/${key}?exp=${expiresAt}&sig=${sig}`
  }
}
