import { randomUUID } from 'node:crypto'
import type { CreateUpload, MediaAssetView, UploadInstructions } from '@elevate/core'
import { schema as s } from '@elevate/db'
import { eq } from 'drizzle-orm'
import type { Deps } from '../deps'
import { errors } from '../lib/errors'
import { hasRole, type SessionUser } from '../middleware/auth'
import { extensionFor, isPublicKey } from '../providers/storage'

type MediaAssetRow = typeof s.mediaAssets.$inferSelect

export class MediaService {
  constructor(private readonly deps: Deps) {}

  /** Images are public (thumbnails, avatars); everything else is private and served via signed URLs. */
  private keyFor(user: SessionUser, id: string, input: CreateUpload): string {
    const ext = extensionFor(input.mimeType, input.filename)
    return input.kind === 'image'
      ? `public/images/${user.id}/${id}.${ext}`
      : `${input.kind}/${user.id}/${id}.${ext}`
  }

  async createUpload(user: SessionUser, input: CreateUpload): Promise<UploadInstructions> {
    const { db, storage } = this.deps
    const id = randomUUID()
    const storageKey = this.keyFor(user, id, input)
    const [asset] = await db
      .insert(s.mediaAssets)
      .values({
        id,
        ownerId: user.id,
        kind: input.kind,
        provider: storage.driver === 's3' ? 's3' : 'local',
        status: 'pending',
        storageKey,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      })
      .returning()
    if (!asset) throw new Error('failed to create media asset')
    const target = await storage.createUploadTarget({
      assetId: id,
      key: storageKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    })
    return { asset: await this.toView(asset), mode: 'put', uploadUrl: target.url }
  }

  /** Local driver: the browser PUTs the bytes straight to the API, which writes them to disk. */
  async receiveLocalUpload(
    assetId: string,
    body: ReadableStream<Uint8Array>,
  ): Promise<MediaAssetView> {
    const { db, storage } = this.deps
    const asset = await db.query.mediaAssets.findFirst({ where: eq(s.mediaAssets.id, assetId) })
    if (!asset || !asset.storageKey) throw errors.notFound('Upload')
    if (asset.status === 'ready')
      throw errors.conflict('already_uploaded', 'This file was already uploaded')
    const { size } = await storage.putStream(asset.storageKey, body, asset.mimeType)
    const [updated] = await db
      .update(s.mediaAssets)
      .set({ status: 'ready', sizeBytes: size })
      .where(eq(s.mediaAssets.id, assetId))
      .returning()
    if (!updated) throw errors.notFound('Upload')
    return this.toView(updated)
  }

  /** Called after a presigned (S3) or local upload finishes; verifies the object exists. */
  async complete(user: SessionUser, assetId: string): Promise<MediaAssetView> {
    const { db, storage } = this.deps
    const asset = await this.getOwnedAsset(user, assetId)
    if (asset.status === 'ready') return this.toView(asset)
    if (!asset.storageKey)
      throw errors.conflict('not_storage_backed', 'This asset is not storage-backed')
    const head = await storage.head(asset.storageKey)
    if (!head) throw errors.conflict('upload_incomplete', 'The file has not been uploaded yet')
    const [updated] = await db
      .update(s.mediaAssets)
      .set({ status: 'ready', sizeBytes: head.size })
      .where(eq(s.mediaAssets.id, assetId))
      .returning()
    if (!updated) throw errors.notFound('Asset')
    return this.toView(updated)
  }

  async getAsset(user: SessionUser, assetId: string): Promise<MediaAssetView> {
    return this.toView(await this.getOwnedAsset(user, assetId))
  }

  /** Owner, or staff (support agents review teaching samples and course media). */
  async getOwnedAsset(user: SessionUser, assetId: string): Promise<MediaAssetRow> {
    const asset = await this.deps.db.query.mediaAssets.findFirst({
      where: eq(s.mediaAssets.id, assetId),
    })
    if (!asset) throw errors.notFound('Asset')
    if (asset.ownerId !== user.id && !hasRole(user, 'support_agent')) throw errors.forbidden()
    return asset
  }

  async getOwnedReadyAsset(
    user: SessionUser,
    assetId: string,
    kind?: MediaAssetRow['kind'],
  ): Promise<MediaAssetRow> {
    const asset = await this.getOwnedAsset(user, assetId)
    if (asset.status !== 'ready')
      throw errors.conflict('asset_not_ready', 'That file has not finished uploading')
    if (kind && asset.kind !== kind) throw errors.badRequest('wrong_kind', `Expected a ${kind}`)
    return asset
  }

  async publicUrl(
    asset: Pick<MediaAssetRow, 'storageKey' | 'status'> | null | undefined,
  ): Promise<string | null> {
    if (!asset?.storageKey || asset.status !== 'ready' || !isPublicKey(asset.storageKey))
      return null
    return this.deps.storage.getUrl(asset.storageKey)
  }

  async toView(asset: MediaAssetRow): Promise<MediaAssetView> {
    return {
      id: asset.id,
      kind: asset.kind,
      provider: asset.provider,
      status: asset.status,
      filename: asset.filename,
      mimeType: asset.mimeType,
      durationSeconds: asset.durationSeconds,
      errorMessage: asset.errorMessage,
      url: await this.publicUrl(asset),
    }
  }
}
