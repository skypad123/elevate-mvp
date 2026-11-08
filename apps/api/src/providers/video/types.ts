import type { PlaybackInfo } from '@elevate/core'
import type { schema } from '@elevate/db'

export type MediaAssetRow = typeof schema.mediaAssets.$inferSelect

export type VideoUploadTarget = {
  uploadUrl: string
  /** 'mux' → hand to the Mux uploader (UpChunk). 'put' → single HTTP PUT of the file body. */
  mode: 'mux' | 'put'
  providerUploadId: string | null
  headers?: Record<string, string>
}

export type VideoWebhookEvent = { id: string; type: string; data: Record<string, unknown> }

export type VideoAssetPatch = Partial<
  Pick<
    MediaAssetRow,
    | 'status'
    | 'providerAssetId'
    | 'playbackId'
    | 'durationSeconds'
    | 'errorMessage'
    | 'width'
    | 'height'
  >
>

export interface VideoProvider {
  readonly driver: 'mux' | 'local' | 'fake'
  createUpload(input: {
    assetId: string
    storageKey: string
    mimeType: string
    sizeBytes: number
    corsOrigin: string
  }): Promise<VideoUploadTarget>
  /** Pulls the current state from the provider; used when webhooks cannot reach the API. */
  refreshStatus(asset: MediaAssetRow): Promise<VideoAssetPatch | null>
  /** Short-lived playback URLs for an asset that is ready. */
  signPlayback(asset: MediaAssetRow): Promise<Extract<PlaybackInfo, { kind: 'video' }>>
  /** Verifies and parses a webhook delivery. Throws on a bad signature. */
  parseWebhook(rawBody: string, headers: Headers): Promise<VideoWebhookEvent>
}

/** Translates a provider webhook into a patch for the matching media row. Pure, so it is testable. */
export function patchForVideoEvent(
  event: VideoWebhookEvent,
  current: Pick<MediaAssetRow, 'status'>,
): VideoAssetPatch | null {
  const data = event.data
  switch (event.type) {
    case 'video.upload.asset_created': {
      if (current.status === 'ready' || current.status === 'errored') return null
      const assetId = typeof data.asset_id === 'string' ? data.asset_id : null
      return { status: 'processing', ...(assetId ? { providerAssetId: assetId } : {}) }
    }
    case 'video.asset.ready': {
      const playbackIds = Array.isArray(data.playback_ids)
        ? (data.playback_ids as Array<{ id?: string; policy?: string }>)
        : []
      const signed = playbackIds.find((p) => p.policy === 'signed') ?? playbackIds[0]
      const duration = typeof data.duration === 'number' ? Math.round(data.duration) : null
      const aspect = typeof data.aspect_ratio === 'string' ? data.aspect_ratio : null
      const maxHeight =
        typeof data.max_stored_resolution === 'string' ? data.max_stored_resolution : null
      return {
        status: 'ready',
        providerAssetId: typeof data.id === 'string' ? data.id : undefined,
        playbackId: signed?.id ?? null,
        durationSeconds: duration,
        errorMessage: null,
        ...(aspect && maxHeight ? {} : {}),
      }
    }
    case 'video.asset.errored': {
      const errors = data.errors as { messages?: string[] } | undefined
      return {
        status: 'errored',
        errorMessage: errors?.messages?.join('; ') ?? 'Video processing failed',
      }
    }
    case 'video.upload.errored':
      return { status: 'errored', errorMessage: 'Upload failed' }
    case 'video.upload.cancelled':
      return { status: 'errored', errorMessage: 'Upload was cancelled' }
    default:
      return null
  }
}

/** Which media row a Mux event refers to: our asset id via passthrough, else provider ids. */
export function videoEventRef(event: VideoWebhookEvent): {
  passthrough?: string
  uploadId?: string
  assetId?: string
} {
  const data = event.data
  const passthrough = typeof data.passthrough === 'string' ? data.passthrough : undefined
  if (event.type.startsWith('video.upload.')) {
    return { passthrough, uploadId: typeof data.id === 'string' ? data.id : undefined }
  }
  return { passthrough, assetId: typeof data.id === 'string' ? data.id : undefined }
}
