# ADR 004 — Media: Mux for video, S3-compatible storage for everything else, local drivers for dev

**Status:** accepted · 2026-11-08

## Decision

- `VideoProvider` interface with two drivers. **Mux**: direct uploads
  (`playback_policies: ['signed']`, `passthrough` = our media id), webhooks for readiness, signed HLS
  and thumbnail JWTs. **Local**: plain HTTP PUT into `.data/`, served through HMAC-signed URLs.
- `StorageProvider` interface (local disk / S3 or R2 presigned PUT) for audio, images, documents and
  certificate PDFs. Audio is served as MP3/AAC without transcoding.
- Playback URLs are minted only by the API after checking enrollment and lesson unlock.
- (Added 2026-11-22 with the hover preview design.) One exception: a short silent clip of a
  course's video is stored as a public image. See [ADR 011](011-course-preview-clips.md).
- On web, `expo-video` (SDK 57 and 58) is a bare `<video>` without HLS, so the learner app uses a
  `VideoArtefact.web.tsx` built on `@mux/mux-player-react`; native uses `expo-video`.

## Consequences

- The whole app runs without Mux or S3 accounts (`VIDEO_DRIVER=local`, `STORAGE_DRIVER=local`),
  except hover previews on course cards, which need Mux.
- Mux webhooks can arrive out of order or twice; handlers are idempotent and monotonic.
