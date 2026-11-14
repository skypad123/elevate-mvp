import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { Env } from '../../env'
import {
  assertSafeKey,
  isPublicKey,
  mimeFromKey,
  type StorageProvider,
  type StoredObject,
  type UploadTarget,
} from './types'

const DEFAULT_TTL = 2 * 60 * 60
const UPLOAD_TTL = 60 * 60

const isMissing = (error: unknown) => {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } }
  return e?.name === 'NoSuchKey' || e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404
}

export type S3StorageOptions = {
  client: S3Client
  bucket: string
  /** Public API origin; `public/` keys are served from `/api/files/*` unless a CDN is configured. */
  apiUrl: string
  /** Optional origin (CloudFront, R2 public bucket) that serves `public/` keys directly. */
  publicBaseUrl?: string
}

/**
 * S3 (or S3-compatible) driver. The bucket stays private: browsers upload with a presigned PUT,
 * private objects are read through presigned GETs, and `public/` keys go through the API's
 * cacheable `/api/files/*` route or a CDN.
 */
export class S3Storage implements StorageProvider {
  readonly driver = 's3'
  private readonly client: S3Client
  private readonly bucket: string
  private readonly apiUrl: string
  private readonly publicBaseUrl: string | undefined

  constructor(options: S3StorageOptions) {
    this.client = options.client
    this.bucket = options.bucket
    this.apiUrl = options.apiUrl.replace(/\/$/, '')
    this.publicBaseUrl = options.publicBaseUrl?.replace(/\/$/, '')
  }

  async createUploadTarget(input: {
    assetId: string
    key: string
    mimeType: string
  }): Promise<UploadTarget> {
    assertSafeKey(input.key)
    // Content-Type is left out of the signature: clients send it as a plain header and S3 stores it.
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: input.key }),
      { expiresIn: UPLOAD_TTL },
    )
    return { url, method: 'PUT', headers: { 'Content-Type': input.mimeType } }
  }

  async put(key: string, body: Uint8Array, mimeType: string): Promise<void> {
    assertSafeKey(key)
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: mimeType }),
    )
  }

  async putStream(
    key: string,
    body: ReadableStream<Uint8Array>,
    mimeType: string,
  ): Promise<{ size: number }> {
    // S3 needs the length up front. Server-side streams here are small (browser uploads go
    // straight to the bucket), so buffering is fine.
    const bytes = new Uint8Array(await new Response(body).arrayBuffer())
    await this.put(key, bytes, mimeType)
    return { size: bytes.byteLength }
  }

  async get(key: string): Promise<StoredObject | null> {
    assertSafeKey(key)
    try {
      const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
      if (!out.Body) return null
      return {
        body: out.Body.transformToWebStream() as ReadableStream<Uint8Array>,
        size: out.ContentLength ?? 0,
        mimeType: out.ContentType ?? mimeFromKey(key),
      }
    } catch (error) {
      if (isMissing(error)) return null
      throw error
    }
  }

  async head(key: string): Promise<{ size: number } | null> {
    assertSafeKey(key)
    try {
      const out = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      return { size: out.ContentLength ?? 0 }
    } catch (error) {
      if (isMissing(error)) return null
      throw error
    }
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key)
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }

  async getUrl(key: string, ttlSeconds = DEFAULT_TTL): Promise<string> {
    assertSafeKey(key)
    if (isPublicKey(key)) return `${this.publicBaseUrl ?? `${this.apiUrl}/api/files`}/${key}`
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentType: mimeFromKey(key),
      }),
      { expiresIn: ttlSeconds },
    )
  }
}

export function createS3Storage(env: Env): S3Storage {
  if (!env.S3_BUCKET) throw new Error('STORAGE_DRIVER=s3 needs S3_BUCKET')
  const staticKeys = env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
  const client = new S3Client({
    region: env.S3_REGION,
    ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT, forcePathStyle: true } : {}),
    ...(staticKeys
      ? {
          credentials: {
            accessKeyId: env.S3_ACCESS_KEY_ID as string,
            secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
          },
        }
      : {}),
  })
  return new S3Storage({
    client,
    bucket: env.S3_BUCKET,
    apiUrl: env.API_URL,
    publicBaseUrl: env.S3_PUBLIC_BASE_URL,
  })
}
