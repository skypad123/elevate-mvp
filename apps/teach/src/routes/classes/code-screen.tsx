import { Logo, Spinner } from '@elevate/web-ui'
import { ApiError, errorMessage } from '@elevate/web-ui/portal'
import { type ReactNode, useEffect, useState } from 'react'
import { useParams } from 'react-router'
import {
  formatBlockSpan,
  formatClassTime,
  type ReceivedCodes,
  useClass,
  useCodes,
  zoneLabel,
} from '../../lib/classes'

/**
 * `performance.now()`, read again every `ms`. The code screen times everything on this clock,
 * from the moment each answer arrived, and never reads the device's wall clock: a device whose
 * clock is wrong must not show a code the server refuses.
 */
function useMonotonicNow(ms: number): number {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), ms)
    return () => window.clearInterval(timer)
  }, [ms])
  return now
}

/** The code showing now, from the last answer, or null once the last one it holds has ended. */
function showing(data: ReceivedCodes, now: number) {
  const elapsed = now - data.receivedAt
  const code = data.codes.find((c) => elapsed >= c.startsInMs && elapsed < c.endsInMs)
  return code ? { code, endsInS: Math.max(1, Math.ceil((code.endsInMs - elapsed) / 1000)) } : null
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/**
 * The projector view of one block, opened from the roster screen in its own window: the class
 * name, the block's time, the QR code, the six characters and a countdown. It shows no learner
 * and no attendance, and sits outside the portal's navigation.
 *
 * It asks for codes every 20 seconds; each answer holds the current code and the next two. While
 * a request fails it keeps showing the codes it holds, and says "Offline" once the last has ended.
 */
export function CodeScreen() {
  const { id = '', blockId = '' } = useParams()
  const detail = useClass(id)
  const codes = useCodes(id, blockId)
  const now = useMonotonicNow(250)

  const block = detail.data?.blocks.find((b) => b.id === blockId)
  const zone = detail.data?.timeZone
  const current = codes.data ? showing(codes.data, now) : null
  const refusal = codes.error instanceof ApiError ? codes.error : null

  let body: ReactNode
  if (detail.data?.status === 'cancelled') {
    body = (
      <Message
        title="This class was cancelled"
        body="Its blocks do not run, so there is no code to show."
      />
    )
  } else if (!codes.data && refusal?.code === 'venue_not_set') {
    body = (
      <Message
        title="Set the venue location first"
        body='On the roster screen, at the venue, choose "Set the venue location here". This screen shows the code once it is set.'
      />
    )
  } else if (!codes.data && codes.error) {
    body = <Message title="Cannot show the code" body={errorMessage(codes.error)} />
  } else if (!codes.data) {
    body = <Spinner className="size-8 text-ink-tertiary" />
  } else if (!current) {
    body = (
      <Message
        title="Offline"
        body="This screen cannot reach Elevate, and the codes it holds have ended. It shows a new code as soon as it is back online."
      />
    )
  } else {
    body = (
      <div className="flex flex-col items-center gap-6">
        <div className="rounded-card p-4" style={{ backgroundColor: '#ffffff' }}>
          <img
            src={svgDataUrl(current.code.qrSvg)}
            alt="QR code to check in"
            className="block size-[min(52vh,80vw)]"
          />
        </div>
        <p className="font-mono text-[clamp(3rem,10vw,7rem)] font-semibold leading-none tracking-[0.2em] text-ink">
          {current.code.typed}
        </p>
        <p className="text-body-lg text-ink-secondary" aria-live="off">
          New code in {current.endsInS} s
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas px-4 py-6">
      <header className="mx-auto flex w-full max-w-5xl flex-wrap items-end justify-between gap-4">
        <Logo size="sm" />
        <div className="text-right">
          <p className="font-display text-h2 font-semibold text-ink">{detail.data?.name ?? ' '}</p>
          {block && zone ? (
            <p className="text-body text-ink-secondary">{formatBlockSpan(block, zone)}</p>
          ) : null}
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 py-6">{body}</main>
      <footer className="mx-auto w-full max-w-5xl text-center text-body text-ink-secondary">
        Scan with your phone's camera, or type the code in the Elevate app.
        {codes.data && zone ? (
          <span className="block text-small text-ink-tertiary">
            Check-in closes at {formatClassTime(codes.data.checkInClosesAt, zone)} {zoneLabel(zone)}
            .
          </span>
        ) : null}
      </footer>
    </div>
  )
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div role="status" className="max-w-xl text-center">
      <p className="font-display text-h1 font-semibold text-ink">{title}</p>
      <p className="mt-3 text-body-lg text-ink-secondary">{body}</p>
    </div>
  )
}
