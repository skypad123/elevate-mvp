import { randomUUID } from 'node:crypto'
import {
  type CreateUpload,
  can,
  type MediaAssetView,
  type PlaybackInfo,
  type UploadInstructions,
} from '@elevate/core'
import { schema as s } from '@elevate/db'
import { eq } from 'drizzle-orm'
import type { Deps } from '../deps'
import { errors } from '../lib/errors'
import { hasRole, type SessionUser } from '../middleware/auth'
import { extensionFor, isPublicKey } from '../providers/storage'
import { patchForVideoEvent, type VideoWebhookEvent, videoEventRef } from '../providers/video'
import { loadActor } from './auth.service'

type MediaAssetRow = typeof s.mediaAssets.$inferSelect

const PLAYBACK_TTL_SECONDS = 2 * 60 * 60
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class MediaService {
  constructor(private readonly deps: Deps) {}

  /** Images are public (thumbnails, avatars); everything else is private and served via signed URLs. */
  private keyFor(user: SessionUser, id: string, input: CreateUpload): string {
    const ext = extensionFor(input.mimeType, input.filename)
    return input.kind === 'image'
      ? `public/images/${user.id}/${id}.${ext}`
      : `${input.kind}/${user.id}/${id}.${ext}`
  }

  /**
   * With `profileId` the file becomes that profile's course media, which everyone on the profile
   * can then use; the caller needs `media.upload` there. Without it the file is the caller's own
   * (an avatar, a teaching sample).
   */
  async createUpload(user: SessionUser, input: CreateUpload): Promise<UploadInstructions> {
    const { db, storage, video, env } = this.deps
    const profileId = input.profileId ?? null
    if (profileId) {
      const actor = await loadActor(this.deps, user, profileId)
      if (!actor) throw errors.notFound('Profile')
      if (!can(actor, 'media.upload')) throw errors.forbidden()
    }
    const id = randomUUID()
    const storageKey = this.keyFor(user, id, input)

    if (input.kind === 'video') {
      const target = await video.createUpload({
        assetId: id,
        storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        corsOrigin: env.isProd ? env.TEACH_URL : '*',
      })
      const provider = video.driver === 'local' ? 'local' : 'mux'
      const [asset] = await db
        .insert(s.mediaAssets)
        .values({
          id,
          uploaderId: user.id,
          profileId,
          kind: 'video',
          provider,
          status: 'pending',
          providerUploadId: target.providerUploadId,
          storageKey: provider === 'local' ? storageKey : null,
          filename: input.filename,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
        })
        .returning()
      if (!asset) throw new Error('failed to create media asset')
      return { asset: await this.toView(asset), mode: target.mode, uploadUrl: target.uploadUrl }
    }

    const [asset] = await db
      .insert(s.mediaAssets)
      .values({
        id,
        uploaderId: user.id,
        profileId,
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
    const asset = await db.query.mediaAssets.findFirst({ where: { id: assetId } })
    if (!asset?.storageKey) throw errors.notFound('Upload')
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
      throw errors.conflict('not_storage_backed', 'This asset is processed by the video provider')
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

  /** For whoever may use the asset; for processing video assets, polls the provider as a webhook fallback. */
  async getAsset(user: SessionUser, assetId: string): Promise<MediaAssetView> {
    let asset = await this.getOwnedAsset(user, assetId)
    if (
      asset.kind === 'video' &&
      asset.provider !== 'local' &&
      (asset.status === 'pending' || asset.status === 'processing')
    ) {
      const patch = await this.deps.video.refreshStatus(asset)
      if (patch) {
        const [updated] = await this.deps.db
          .update(s.mediaAssets)
          .set(patch)
          .where(eq(s.mediaAssets.id, assetId))
          .returning()
        if (updated) asset = updated
      }
    }
    return this.toView(asset)
  }

  /** Signed playback for whoever may use the asset. Learner playback is authorised through enrollments. */
  async playback(user: SessionUser, assetId: string): Promise<PlaybackInfo> {
    const asset = await this.getOwnedAsset(user, assetId)
    return this.playbackFor(asset)
  }

  async playbackFor(asset: MediaAssetRow): Promise<PlaybackInfo> {
    if (asset.status !== 'ready')
      throw errors.conflict('asset_not_ready', 'This file is still processing')
    const { storage, video } = this.deps
    if (asset.kind === 'video') {
      if (asset.provider === 'local') {
        if (!asset.storageKey) throw errors.conflict('asset_not_ready', 'This video has no file')
        return {
          kind: 'video',
          provider: 'local',
          url: await storage.getUrl(asset.storageKey, PLAYBACK_TTL_SECONDS),
          thumbnailUrl: null,
        }
      }
      return video.signPlayback(asset)
    }
    if (!asset.storageKey) throw errors.conflict('asset_not_ready', 'This file has no storage key')
    const url = await storage.getUrl(asset.storageKey, PLAYBACK_TTL_SECONDS)
    if (asset.kind === 'audio') return { kind: 'audio', url }
    return { kind: asset.kind, url }
  }

  /** Applies a provider webhook (Mux) to the matching media row. Idempotent and monotonic. */
  async applyVideoEvent(event: VideoWebhookEvent): Promise<'applied' | 'ignored' | 'unmatched'> {
    const { db } = this.deps
    const ref = videoEventRef(event)
    const conditions: Array<
      { id: string } | { providerUploadId: string } | { providerAssetId: string }
    > = []
    if (ref.passthrough && UUID.test(ref.passthrough)) conditions.push({ id: ref.passthrough })
    if (ref.uploadId) conditions.push({ providerUploadId: ref.uploadId })
    if (ref.assetId) conditions.push({ providerAssetId: ref.assetId })
    if (conditions.length === 0) return 'unmatched'
    const asset = await db.query.mediaAssets.findFirst({ where: { OR: conditions } })
    if (!asset) return 'unmatched'
    const patch = patchForVideoEvent(event, asset)
    if (!patch) return 'ignored'
    await db.update(s.mediaAssets).set(patch).where(eq(s.mediaAssets.id, asset.id))
    return 'applied'
  }

  /**
   * An asset the user may read. A profile's course media belongs to the profile: everyone on the
   * profile may read it, and someone who has left it may not, even if they uploaded the file. An
   * asset with no profile (an avatar, a teaching sample) belongs to whoever uploaded it. Staff
   * may read any asset, because support agents review teaching samples and course media.
   *
   * A company's registry document is the exception among uploads with no profile: once it is on
   * an application, its uploader can read it only while that application is waiting for review.
   * After the decision it is for Support alone. It can name the company's officers, and the
   * person who uploaded it may no longer be the profile's owner.
   */
  async getOwnedAsset(user: SessionUser, assetId: string): Promise<MediaAssetRow> {
    const { db } = this.deps
    const asset = await db.query.mediaAssets.findFirst({ where: { id: assetId } })
    if (!asset) throw errors.notFound('Asset')
    if (hasRole(user, 'support_agent')) return asset
    let allowed: boolean
    if (asset.profileId !== null) {
      allowed = (await loadActor(this.deps, user, asset.profileId)) !== null
    } else {
      allowed = asset.uploaderId === user.id
      if (allowed && asset.kind === 'document') {
        const entity = await db.query.legalEntities.findFirst({
          where: { registryDocumentMediaId: asset.id },
          columns: { id: true },
          with: { profile: { columns: { status: true } } },
        })
        if (entity) allowed = entity.profile?.status === 'applied'
      }
    }
    if (!allowed) throw errors.forbidden()
    return asset
  }

  /**
   * An asset to put on a profile's course: it must be that profile's own. Another profile's
   * asset is reported as not found, even to someone who belongs to both profiles, so one
   * profile's media cannot be attached to another profile's course.
   */
  async getProfileAsset(
    profileId: string,
    assetId: string,
    options: { ready?: boolean; kind?: MediaAssetRow['kind'] } = {},
  ): Promise<MediaAssetRow> {
    const asset = await this.deps.db.query.mediaAssets.findFirst({
      where: { id: assetId, profileId },
    })
    if (!asset) throw errors.notFound('Asset')
    if (options.ready && asset.status !== 'ready')
      throw errors.conflict('asset_not_ready', 'That file has not finished uploading')
    if (options.kind && asset.kind !== options.kind)
      throw errors.badRequest('wrong_kind', `Expected a ${options.kind}`)
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
