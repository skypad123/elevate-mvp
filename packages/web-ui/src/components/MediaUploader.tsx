import type { MediaAssetView, MediaKind, UploadInstructions } from '@elevate/core'
import { ACCEPTED_MIME } from '@elevate/core'
import MuxUploader from '@mux/mux-uploader-react'
import {
  CheckCircle2,
  CircleAlert,
  FileAudio,
  FileText,
  Film,
  ImageIcon,
  Loader2,
  Upload,
  X,
} from 'lucide-react'
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import { type PortalApi, unwrap } from '../portal/api'
import { useErrorMessage } from '../preferences/errors'
import { useT } from '../preferences/PreferencesProvider'
import { Badge, statusTone } from './Badge'
import { Button } from './Button'

type Phase =
  | { kind: 'idle' }
  | { kind: 'requesting' }
  | { kind: 'uploading'; percent: number; instructions: UploadInstructions }
  | { kind: 'processing'; asset: MediaAssetView }
  | { kind: 'error'; message: string }

export type MediaUploaderProps = {
  api: PortalApi
  kind: MediaKind
  value: MediaAssetView | null
  onChange: (asset: MediaAssetView | null) => void
  /**
   * The teaching profile the file belongs to. Set it for a profile's own media (course content,
   * thumbnails, its avatar), so everyone on the profile can use the file; leave it out for a
   * person's own files, such as a teaching sample sent with an application.
   */
  profileId?: string
  label?: string
  hint?: string
  disabled?: boolean
  className?: string
}

const KIND_ICON = { video: Film, audio: FileAudio, image: ImageIcon, document: FileText } as const

/** `failed` words the error for the reader: it gets the HTTP status when there was an answer. */
function putWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
  failed: (status?: number) => string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(failed(xhr.status)))
    xhr.onerror = () => reject(new Error(failed()))
    xhr.send(file)
  })
}

/**
 * Picks a file, asks the API for an upload target, uploads it (Mux UpChunk or a plain PUT), then
 * polls the asset until the provider reports it ready.
 */
export function MediaUploader({
  api,
  kind,
  value,
  onChange,
  profileId,
  label,
  hint,
  disabled,
  className,
}: MediaUploaderProps) {
  const t = useT()
  const errorMessage = useErrorMessage()
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<number | null>(null)
  const Icon = KIND_ICON[kind]

  const stopPolling = useCallback(() => {
    if (pollRef.current) window.clearInterval(pollRef.current)
    pollRef.current = null
  }, [])
  useEffect(() => stopPolling, [stopPolling])

  const pollUntilReady = useCallback(
    (assetId: string) => {
      stopPolling()
      const tick = async () => {
        try {
          const { asset } = await unwrap(
            await api.media.assets[':id'].$get({ param: { id: assetId } }),
          )
          if (asset.status === 'ready') {
            stopPolling()
            setPhase({ kind: 'idle' })
            onChange(asset)
          } else if (asset.status === 'errored') {
            stopPolling()
            setPhase({
              kind: 'error',
              message: asset.errorMessage ?? t('ui.upload.processingFailed'),
            })
          } else {
            setPhase({ kind: 'processing', asset })
          }
        } catch (error) {
          stopPolling()
          setPhase({ kind: 'error', message: errorMessage(error) })
        }
      }
      void tick()
      pollRef.current = window.setInterval(tick, 3000)
    },
    [api, onChange, stopPolling, t, errorMessage],
  )

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPhase({ kind: 'requesting' })
    try {
      const instructions = await unwrap(
        await api.media.uploads.$post({
          json: {
            kind,
            filename: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            ...(profileId ? { profileId } : {}),
          },
        }),
      )
      if (instructions.mode === 'put') {
        setPhase({ kind: 'uploading', percent: 0, instructions })
        await putWithProgress(
          instructions.uploadUrl,
          file,
          (percent) => setPhase({ kind: 'uploading', percent, instructions }),
          (status) =>
            status === undefined ? t('ui.upload.failed') : t('ui.upload.failedStatus', { status }),
        )
        pollUntilReady(instructions.asset.id)
      } else {
        // Mux: render the uploader, which streams the file; we poll once it reports success.
        setPhase({ kind: 'uploading', percent: 0, instructions })
        pendingFile.current = file
      }
    } catch (error) {
      setPhase({ kind: 'error', message: errorMessage(error) })
    }
  }

  const pendingFile = useRef<File | null>(null)

  const clear = () => {
    stopPolling()
    pendingFile.current = null
    setPhase({ kind: 'idle' })
    onChange(null)
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label ? <p className="text-small-strong font-semibold text-ink-secondary">{label}</p> : null}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={ACCEPTED_MIME[kind].join(',')}
        onChange={handleFile}
        disabled={disabled}
      />

      {value && phase.kind === 'idle' ? (
        <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-3">
          {kind === 'image' && value.url ? (
            <img src={value.url} alt="" className="size-16 rounded-sm object-cover" />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-sm bg-brand-tint text-brand-fg">
              <Icon className="size-6" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-small-strong font-semibold text-ink">{value.filename}</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge tone={statusTone[value.status] ?? 'neutral'}>
                {t(`ui.mediaStatus.${value.status}`)}
              </Badge>
              {value.durationSeconds ? (
                <span className="text-caption text-ink-tertiary">
                  {t('ui.upload.minutes', { count: Math.round(value.durationSeconds / 60) })}
                </span>
              ) : null}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            {t('ui.upload.replace')}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('common.remove')}
            onClick={clear}
            disabled={disabled}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : phase.kind === 'uploading' && phase.instructions.mode === 'mux' ? (
        <div className="rounded-card border border-border bg-surface p-3">
          <MuxUploader
            endpoint={phase.instructions.uploadUrl}
            noDrop
            onUploadStart={() => {}}
            onProgress={(e) =>
              setPhase((p) =>
                p.kind === 'uploading'
                  ? { ...p, percent: Math.round((e as CustomEvent<number>).detail) }
                  : p,
              )
            }
            onSuccess={() => pollUntilReady(phase.instructions.asset.id)}
            onUploadError={(e) =>
              setPhase({
                kind: 'error',
                message:
                  (e as CustomEvent<{ message?: string }>).detail?.message ?? t('ui.upload.failed'),
              })
            }
            style={
              {
                '--uploader-font-family': 'Inter, system-ui, sans-serif',
                '--progress-bar-fill-color': 'var(--brand)',
              } as React.CSSProperties
            }
          />
          <p className="mt-2 text-caption text-ink-tertiary">{t('ui.upload.toVideoPipeline')}</p>
        </div>
      ) : (
        <button
          type="button"
          disabled={
            disabled ||
            phase.kind === 'requesting' ||
            phase.kind === 'uploading' ||
            phase.kind === 'processing'
          }
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex w-full flex-col items-center gap-2 rounded-card border border-dashed border-border-strong bg-surface-muted px-4 py-8 text-center transition-colors hover:border-brand hover:bg-brand-tint/40 disabled:cursor-default disabled:hover:border-border-strong disabled:hover:bg-surface-muted',
            phase.kind === 'error' && 'border-danger',
          )}
        >
          {phase.kind === 'requesting' || phase.kind === 'processing' ? (
            <Loader2 className="size-6 animate-spin text-brand-fg" />
          ) : phase.kind === 'error' ? (
            <CircleAlert className="size-6 text-danger" />
          ) : phase.kind === 'uploading' ? (
            <Upload className="size-6 text-brand-fg" />
          ) : (
            <Icon className="size-6 text-brand-fg" />
          )}
          <span className="text-small-strong font-semibold text-ink">
            {phase.kind === 'requesting'
              ? t('ui.upload.preparing')
              : phase.kind === 'uploading'
                ? t('ui.upload.uploading', { percent: phase.percent })
                : phase.kind === 'processing'
                  ? t('ui.upload.processing')
                  : phase.kind === 'error'
                    ? phase.message
                    : t(`ui.upload.${kind}`)}
          </span>
          {phase.kind === 'uploading' ? (
            <span className="h-1.5 w-full max-w-xs overflow-hidden rounded-pill bg-surface-sunken">
              <span
                className="block h-full bg-brand transition-[width]"
                style={{ width: `${phase.percent}%` }}
              />
            </span>
          ) : null}
          {phase.kind === 'processing' ? (
            <span className="text-caption text-ink-tertiary">{t('ui.upload.processing.hint')}</span>
          ) : null}
          {phase.kind === 'idle' && hint ? (
            <span className="text-caption text-ink-tertiary">{hint}</span>
          ) : null}
          {phase.kind === 'error' ? (
            <span className="text-caption text-ink-secondary">{t('ui.upload.retry')}</span>
          ) : null}
        </button>
      )}
      {value && phase.kind === 'idle' && value.status === 'ready' ? (
        <p className="flex items-center gap-1 text-caption text-success">
          <CheckCircle2 className="size-3.5" /> {t('ui.upload.ready')}
        </p>
      ) : null}
    </div>
  )
}
