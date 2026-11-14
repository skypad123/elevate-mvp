import { z } from 'zod'

export const mediaKindSchema = z.enum(['video', 'audio', 'image', 'document'])
export type MediaKind = z.infer<typeof mediaKindSchema>

export const MAX_UPLOAD_BYTES: Record<MediaKind, number> = {
  video: 4 * 1024 * 1024 * 1024,
  audio: 500 * 1024 * 1024,
  image: 10 * 1024 * 1024,
  document: 25 * 1024 * 1024,
}

export const ACCEPTED_MIME: Record<MediaKind, readonly string[]> = {
  video: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/x-m4a', 'audio/wav', 'audio/ogg'],
  image: ['image/jpeg', 'image/png', 'image/webp'],
  document: ['application/pdf'],
}

export const createUploadSchema = z
  .object({
    kind: mediaKindSchema,
    filename: z.string().trim().min(1).max(255),
    mimeType: z.string().min(3).max(100),
    sizeBytes: z.number().int().positive(),
    /** Course media: the profile the file belongs to. The caller needs `media.upload` on it. */
    profileId: z.string().uuid().optional(),
  })
  .superRefine((v, ctx) => {
    if (!ACCEPTED_MIME[v.kind].includes(v.mimeType)) {
      ctx.addIssue({
        code: 'custom',
        path: ['mimeType'],
        message: `Unsupported ${v.kind} type: ${v.mimeType}`,
      })
    }
    if (v.sizeBytes > MAX_UPLOAD_BYTES[v.kind]) {
      ctx.addIssue({ code: 'custom', path: ['sizeBytes'], message: 'File is too large' })
    }
  })
export type CreateUpload = z.infer<typeof createUploadSchema>

export type MediaAssetView = {
  id: string
  kind: MediaKind
  provider: 'local' | 'mux' | 's3'
  status: 'pending' | 'processing' | 'ready' | 'errored'
  filename: string
  mimeType: string
  durationSeconds: number | null
  errorMessage: string | null
  /** Public URL for images (thumbnails, avatars); null for private kinds, which use playback endpoints. */
  url: string | null
}

export type UploadInstructions = {
  asset: MediaAssetView
  /** 'mux' → hand the URL to the Mux uploader (UpChunk). 'put' → a single HTTP PUT of the file body. */
  mode: 'mux' | 'put'
  uploadUrl: string
}

export type PlaybackInfo =
  | {
      kind: 'video'
      provider: 'mux'
      playbackId: string
      hlsUrl: string
      thumbnailUrl: string
      tokens: { playback: string; thumbnail: string }
    }
  | { kind: 'video'; provider: 'local' | 's3'; url: string; thumbnailUrl: string | null }
  | { kind: 'audio'; url: string }
  | { kind: 'image' | 'document'; url: string }
