import type { StorageProvider } from '../storage'
import type {
  MediaAssetRow,
  VideoAssetPatch,
  VideoProvider,
  VideoUploadTarget,
  VideoWebhookEvent,
} from './types'

/** Dev driver: the file is stored like any other object and played back directly (MP4/WebM). */
export class LocalVideoProvider implements VideoProvider {
  readonly driver = 'local'
  constructor(private readonly storage: StorageProvider) {}

  async createUpload(input: {
    assetId: string
    storageKey: string
    mimeType: string
    sizeBytes: number
  }): Promise<VideoUploadTarget> {
    const target = await this.storage.createUploadTarget({
      assetId: input.assetId,
      key: input.storageKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    })
    return { uploadUrl: target.url, mode: 'put', providerUploadId: null, headers: target.headers }
  }

  async refreshStatus(asset: MediaAssetRow): Promise<VideoAssetPatch | null> {
    if (!asset.storageKey) return null
    const head = await this.storage.head(asset.storageKey)
    return head ? { status: 'ready' } : null
  }

  async signPlayback(asset: MediaAssetRow) {
    if (!asset.storageKey) throw new Error('asset has no storage key')
    return {
      kind: 'video' as const,
      provider: 'local' as const,
      url: await this.storage.getUrl(asset.storageKey, 2 * 60 * 60),
      thumbnailUrl: null,
    }
  }

  async parseWebhook(): Promise<VideoWebhookEvent> {
    throw new Error('The local video driver does not receive webhooks')
  }
}
