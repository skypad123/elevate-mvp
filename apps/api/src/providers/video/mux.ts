import { COURSE_PREVIEW } from '@elevate/core'
import Mux from '@mux/mux-node'
import type {
  AnimatedPreview,
  AnimatedPreviewOptions,
  MediaAssetRow,
  VideoAssetPatch,
  VideoProvider,
  VideoUploadTarget,
  VideoWebhookEvent,
} from './types'

export type MuxConfig = {
  tokenId: string
  tokenSecret: string
  webhookSecret?: string
  signingKeyId: string
  signingPrivateKey: string
  /** Mark assets as test assets (watermarked, auto-deleted) in development. */
  testMode: boolean
}

export class MuxVideoProvider implements VideoProvider {
  readonly driver = 'mux'
  private readonly mux: Mux

  /** `fetchImpl` is the global `fetch` unless a test passes a stub. */
  constructor(
    private readonly config: MuxConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.mux = new Mux({
      tokenId: config.tokenId,
      tokenSecret: config.tokenSecret,
      webhookSecret: config.webhookSecret,
      jwtSigningKey: config.signingKeyId,
      jwtPrivateKey: config.signingPrivateKey,
    })
  }

  async createUpload(input: { assetId: string; corsOrigin: string }): Promise<VideoUploadTarget> {
    const upload = await this.mux.video.uploads.create({
      cors_origin: input.corsOrigin,
      timeout: 3600,
      test: this.config.testMode,
      new_asset_settings: {
        playback_policies: ['signed'],
        passthrough: input.assetId,
        video_quality: 'basic',
        max_resolution_tier: '1080p',
      },
    })
    if (!upload.url) throw new Error('Mux did not return an upload URL')
    return { uploadUrl: upload.url, mode: 'mux', providerUploadId: upload.id }
  }

  async refreshStatus(asset: MediaAssetRow): Promise<VideoAssetPatch | null> {
    let muxAssetId = asset.providerAssetId
    if (!muxAssetId && asset.providerUploadId) {
      const upload = await this.mux.video.uploads.retrieve(asset.providerUploadId)
      if (upload.status === 'errored') return { status: 'errored', errorMessage: 'Upload failed' }
      if (upload.status === 'cancelled')
        return { status: 'errored', errorMessage: 'Upload was cancelled' }
      muxAssetId = upload.asset_id ?? null
      if (!muxAssetId) return null
    }
    if (!muxAssetId) return null
    const muxAsset = await this.mux.video.assets.retrieve(muxAssetId)
    if (muxAsset.status === 'ready') {
      const signed =
        muxAsset.playback_ids?.find((p) => p.policy === 'signed') ?? muxAsset.playback_ids?.[0]
      return {
        status: 'ready',
        providerAssetId: muxAsset.id,
        playbackId: signed?.id ?? null,
        durationSeconds: muxAsset.duration ? Math.round(muxAsset.duration) : null,
        errorMessage: null,
      }
    }
    if (muxAsset.status === 'errored') {
      return {
        status: 'errored',
        providerAssetId: muxAsset.id,
        errorMessage: muxAsset.errors?.messages?.join('; ') ?? 'Video processing failed',
      }
    }
    return { status: 'processing', providerAssetId: muxAsset.id }
  }

  async signPlayback(asset: MediaAssetRow) {
    if (!asset.playbackId) throw new Error('asset has no playback id')
    const [playback, thumbnail] = await Promise.all([
      this.mux.jwt.signPlaybackId(asset.playbackId, { type: 'video', expiration: '2h' }),
      this.mux.jwt.signPlaybackId(asset.playbackId, {
        type: 'thumbnail',
        expiration: '2h',
        params: { time: '2', width: '640' },
      }),
    ])
    return {
      kind: 'video' as const,
      provider: 'mux' as const,
      playbackId: asset.playbackId,
      hlsUrl: `https://stream.mux.com/${asset.playbackId}.m3u8?token=${playback}`,
      thumbnailUrl: `https://image.mux.com/${asset.playbackId}/thumbnail.jpg?token=${thumbnail}`,
      tokens: { playback, thumbnail },
    }
  }

  async parseWebhook(rawBody: string, headers: Headers): Promise<VideoWebhookEvent> {
    if (!this.config.webhookSecret) throw new Error('MUX_WEBHOOK_SECRET is not configured')
    const event = this.mux.webhooks.unwrap(
      rawBody,
      headers,
      this.config.webhookSecret,
    ) as unknown as {
      id: string
      type: string
      data: Record<string, unknown>
    }
    return { id: event.id, type: event.type, data: event.data }
  }

  /**
   * Signs a `gif` token (audience `g`) with the clip's options as claims, and fetches the animated
   * WebP from Mux. This is the API's one plain HTTP request to another service, so it sets its own
   * limits: a timeout, status 200 with `image/webp` only, and a size cap. Mux's error bodies are
   * JSON, and without these checks one could be stored as a public `.webp`.
   */
  async animatedPreview(
    asset: MediaAssetRow,
    options: AnimatedPreviewOptions,
  ): Promise<AnimatedPreview | null> {
    if (!asset.playbackId) return null
    try {
      const token = await this.mux.jwt.signPlaybackId(asset.playbackId, {
        type: 'gif',
        expiration: '5m',
        params: {
          start: String(options.startSeconds),
          end: String(options.endSeconds),
          width: String(options.width),
          fps: String(options.fps),
        },
      })
      const url = `https://image.mux.com/${asset.playbackId}/animated.webp?token=${encodeURIComponent(token)}`
      // The one signal covers the wait for the response and the reading of its body.
      const response = await this.fetchImpl(url, {
        signal: AbortSignal.timeout(COURSE_PREVIEW.fetchTimeoutMs),
      })
      const type = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
      const length = Number(response.headers.get('content-length') ?? Number.NaN)
      if (
        response.status !== 200 ||
        type !== 'image/webp' ||
        (Number.isFinite(length) && length > COURSE_PREVIEW.maxBytes)
      ) {
        await response.body?.cancel().catch(() => {})
        return null
      }
      const bytes = await readCapped(response, COURSE_PREVIEW.maxBytes)
      return bytes ? { bytes, mimeType: 'image/webp' } : null
    } catch {
      return null
    }
  }
}

/** The body's bytes, or `null` as soon as it passes `max`. */
async function readCapped(response: Response, max: number): Promise<Uint8Array | null> {
  if (!response.body) return new Uint8Array(await response.arrayBuffer())
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }
  const out = new Uint8Array(size)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  return out
}
