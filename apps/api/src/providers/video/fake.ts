import type {
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
