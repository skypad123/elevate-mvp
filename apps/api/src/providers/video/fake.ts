import type {
  AnimatedPreview,
  AnimatedPreviewOptions,
  MediaAssetRow,
  VideoAssetPatch,
  VideoProvider,
  VideoUploadTarget,
  VideoWebhookEvent,
} from './types'

/** In-memory Mux stand-in for tests. Webhooks are JSON bodies with header `mux-signature: fake-valid`. */
export class FakeVideoProvider implements VideoProvider {
  readonly driver = 'fake'
  readonly uploads = new Map<string, { assetId: string; muxAssetId: string }>()
  private counter = 0

  /** Every `animatedPreview` call, in order. */
  readonly previewCalls: Array<{ assetId: string; options: AnimatedPreviewOptions }> = []
  /** What `animatedPreview` does: return the fixed bytes, return `null`, or throw. */
  previewMode: 'ok' | 'null' | 'throw' = 'ok'
  /** Awaited at the start of each `animatedPreview` call, so a test can change the course meanwhile. */
  onPreview?: () => unknown | Promise<unknown>

  async createUpload(input: { assetId: string }): Promise<VideoUploadTarget> {
    const uploadId = `upl_${++this.counter}`
    this.uploads.set(uploadId, { assetId: input.assetId, muxAssetId: `ast_${this.counter}` })
    return {
      uploadUrl: `https://fake-mux.test/upload/${uploadId}`,
      mode: 'mux',
      providerUploadId: uploadId,
    }
  }

  async refreshStatus(): Promise<VideoAssetPatch | null> {
    return null
  }

  async signPlayback(asset: MediaAssetRow) {
    return {
      kind: 'video' as const,
      provider: 'mux' as const,
      playbackId: asset.playbackId ?? 'pb_fake',
      hlsUrl: `https://stream.fake-mux.test/${asset.playbackId}.m3u8?token=fake`,
      thumbnailUrl: `https://image.fake-mux.test/${asset.playbackId}/thumbnail.jpg?token=fake`,
      tokens: { playback: 'fake-playback', thumbnail: 'fake-thumbnail' },
    }
  }

  async parseWebhook(rawBody: string, headers: Headers): Promise<VideoWebhookEvent> {
    if (headers.get('mux-signature') !== 'fake-valid') throw new Error('invalid signature')
    const parsed = JSON.parse(rawBody) as VideoWebhookEvent
    return parsed
  }

  async animatedPreview(
    asset: MediaAssetRow,
    options: AnimatedPreviewOptions,
  ): Promise<AnimatedPreview | null> {
    if (this.onPreview) await this.onPreview()
    this.previewCalls.push({ assetId: asset.id, options })
    if (this.previewMode === 'throw') throw new Error('fake preview failure')
    if (this.previewMode === 'null') return null
    return { bytes: new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4]), mimeType: 'image/webp' }
  }

  /** Builds the two webhook deliveries Mux sends for an upload. */
  eventsFor(
    uploadId: string,
    options: { duration?: number } = {},
  ): { created: VideoWebhookEvent; ready: VideoWebhookEvent } {
    const upload = this.uploads.get(uploadId)
    if (!upload) throw new Error(`unknown fake upload ${uploadId}`)
    return {
      created: {
        id: `evt_created_${uploadId}`,
        type: 'video.upload.asset_created',
        data: { id: uploadId, asset_id: upload.muxAssetId, passthrough: upload.assetId },
      },
      ready: {
        id: `evt_ready_${uploadId}`,
        type: 'video.asset.ready',
        data: {
          id: upload.muxAssetId,
          passthrough: upload.assetId,
          duration: options.duration ?? 125.4,
          playback_ids: [{ id: `pb_${uploadId}`, policy: 'signed' }],
        },
      },
    }
  }
}
