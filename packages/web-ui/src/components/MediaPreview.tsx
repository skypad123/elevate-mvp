import type { PlaybackInfo } from '@elevate/core'
import MuxPlayer from '@mux/mux-player-react'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, FileText } from 'lucide-react'
import { cn } from '../lib/cn'
import { errorMessage, type PortalApi, unwrap } from '../portal/api'
import { Skeleton } from './Skeleton'

/** Plays or shows any media asset the viewer may access (owner or staff). */
export function MediaPreview({
  api,
  assetId,
  className,
}: {
  api: PortalApi
  assetId: string
  className?: string
}) {
  const query = useQuery({
    queryKey: ['media', 'playback', assetId],
    queryFn: async () =>
      (await unwrap(await api.media.assets[':id'].playback.$get({ param: { id: assetId } })))
        .playback as PlaybackInfo,
    staleTime: 60 * 60 * 1000,
  })
  if (query.isPending)
    return <Skeleton className={cn('aspect-video w-full rounded-card', className)} />
  if (query.isError)
    return (
      <p
        className={cn(
          'rounded-card border border-danger bg-danger-tint p-3 text-small text-danger',
          className,
        )}
      >
        {errorMessage(query.error)}
      </p>
    )
  const playback = query.data
  if (playback.kind === 'video') {
    return (
      <div className={cn('overflow-hidden rounded-card bg-black', className)}>
        {playback.provider === 'mux' ? (
          <MuxPlayer
            playbackId={playback.playbackId}
            tokens={{ playback: playback.tokens.playback, thumbnail: playback.tokens.thumbnail }}
            streamType="on-demand"
            style={{
              aspectRatio: '16 / 9',
              width: '100%',
              // Follows the portal palette instead of a fixed hex.
              '--media-accent-color': 'var(--brand)',
            }}
          />
        ) : (
          <video
            src={playback.url}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full"
          >
            <track kind="captions" />
          </video>
        )}
      </div>
    )
  }
  if (playback.kind === 'audio') {
    return (
      <audio controls preload="metadata" src={playback.url} className={cn('w-full', className)}>
        <track kind="captions" />
      </audio>
    )
  }
  if (playback.kind === 'image') {
    return (
      <img
        src={playback.url}
        alt=""
        className={cn('max-h-96 rounded-card object-contain', className)}
      />
    )
  }
  return (
    <a
      href={playback.url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'inline-flex items-center gap-2 rounded-control border border-border bg-surface px-3 py-2 text-small font-semibold text-brand-fg hover:bg-brand-tint',
        className,
      )}
    >
      <FileText className="size-4" /> Open document <ExternalLink className="size-3.5" />
    </a>
  )
}
