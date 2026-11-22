import {
  COURSE_PREVIEW,
  type CoursePreviewState,
  type CourseView,
  formatPreviewStart,
  type UpdateCourse,
} from '@elevate/core'
import { Button, Card, CardHeader, NativeSelect } from '@elevate/web-ui'
import { useState } from 'react'
import { useCourseActions } from '../lib/courses'
import { useSaveTracker } from '../lib/save-tracker'

/** The state's sentence, word for word from the design's table. `pending` adds "Make clip". */
const STATE_SENTENCE: Record<CoursePreviewState, string> = {
  off: 'No preview is shown.',
  no_video: 'Add a video to a lesson to get a preview.',
  not_live: 'The clip is made when the course goes live, if its video has a clip change left.',
  paused: 'Elevate has previews switched off.',
  limit:
    "This video has no clip changes left, so its clip can't be made or changed. Choose another video, or turn the preview off.",
  pending: 'The clip is not up to date.',
  ready: 'This is what visitors see.',
}

type Video = CourseView['preview']['videos'][number]

/** The last allowed start of `video` that is not above `saved`, as a select value. */
function startOption(saved: number | null, video: Video | undefined): string {
  if (saved === null || !video) return ''
  let best: number | null = null
  for (const s of video.starts) if (s <= saved) best = s
  return best === null ? '' : String(best)
}

function changesLeftLine(changesLeft: number): string {
  if (changesLeft === 0)
    return "This video has no clip changes left. If you turn the preview off, this video can't be used for a clip again."
  if (changesLeft === 1) return 'This video has 1 clip change left.'
  return `This video has ${changesLeft} clip changes left.`
}

/**
 * The hover preview's control on the Details tab: whether the course card plays a clip, from which
 * video and second. It saves through the course-details route on its own button. What the API
 * resolved and the state come from the course view; the card does not apply the rule itself.
 */
export function PreviewCard({ course, locked }: { course: CourseView; locked: boolean }) {
  const actions = useCourseActions(course.id)
  const { track } = useSaveTracker()
  const { preview } = course
  const { videos } = preview
  const videoOf = (mediaId: string) => videos.find((v) => v.mediaId === mediaId)

  // A saved choice whose video has left the course starts the card on "Default", with the start
  // emptied too: it was chosen for the removed video. That is not a change.
  const stale = preview.mediaId !== null && !videoOf(preview.mediaId)
  const startMediaId = stale ? '' : (preview.mediaId ?? '')
  const startStart = stale
    ? ''
    : startOption(preview.startSeconds, startMediaId ? videoOf(startMediaId) : videos[0])

  const [enabled, setEnabled] = useState(preview.enabled)
  const [mediaId, setMediaId] = useState(startMediaId)
  const [start, setStart] = useState(startStart)
  const [busy, setBusy] = useState(false)

  // The video that supplies the starts: the one selected, or the default video.
  const startsVideo = mediaId ? videoOf(mediaId) : videos[0]
  const changed = enabled !== preview.enabled || mediaId !== startMediaId || start !== startStart
  const makeClip = !changed && preview.state === 'pending'
  const resolvedVideo = preview.resolved ? videoOf(preview.resolved.mediaId) : undefined

  async function send(patch: UpdateCourse) {
    setBusy(true)
    try {
      await track(actions.updateCourse(patch))
    } catch {
      // toasted by actions
    } finally {
      setBusy(false)
    }
  }

  function onPress() {
    if (makeClip) {
      // The saved choice as this page loaded it, and no on or off value, so a tab left open
      // can't turn back on a preview that was turned off elsewhere.
      void send(
        stale
          ? { previewMediaId: null, previewStartSeconds: null }
          : { previewMediaId: preview.mediaId, previewStartSeconds: preview.startSeconds },
      )
    } else if (!enabled) {
      void send({ previewEnabled: false })
    } else {
      void send({
        previewEnabled: true,
        previewMediaId: mediaId || null,
        previewStartSeconds: start === '' ? null : Number(start),
      })
    }
  }

  return (
    <Card as="section" className="space-y-4">
      <CardHeader
        title="Hover preview"
        description="Four silent seconds of your course's video, shown on the course card in Explore when a visitor rests the mouse on it. Anyone can see it."
      />
      <div className="space-y-1">
        <label className="flex cursor-pointer items-center gap-2 text-small text-ink">
          <input
            type="checkbox"
            className="size-4 accent-[var(--brand)]"
            checked={enabled}
            disabled={locked}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Show a hover preview on the course card
        </label>
        <p className="text-small text-ink-tertiary">
          Turning the preview off deletes the clip. Turning it on again makes a new clip, which uses
          one of the video's clip changes.
        </p>
      </div>
      <NativeSelect
        label="Video"
        value={mediaId}
        disabled={locked || !enabled}
        onChange={(e) => {
          setMediaId(e.target.value)
          setStart('')
        }}
      >
        <option value="">Default: the course's first video</option>
        {videos.map((v) => (
          <option key={v.mediaId} value={v.mediaId}>
            {v.lessonTitle}: {v.itemTitle}
          </option>
        ))}
      </NativeSelect>
      {stale ? (
        <p className="text-small text-warning">
          The video you chose is no longer on this course. The default is used.
        </p>
      ) : null}
      <div className="space-y-1">
        <NativeSelect
          label="Start"
          value={start}
          disabled={locked || !enabled || startsVideo?.changesLeft === 0}
          onChange={(e) => setStart(e.target.value)}
        >
          <option value="">Default</option>
          {(startsVideo?.starts ?? []).map((s) => (
            <option key={s} value={String(s)}>
              {formatPreviewStart(s)}
            </option>
          ))}
        </NativeSelect>
        {startsVideo ? (
          <p className="text-small text-ink-tertiary">{changesLeftLine(startsVideo.changesLeft)}</p>
        ) : null}
      </div>
      {preview.clipUrl ? (
        <img
          src={preview.clipUrl}
          alt=""
          className="aspect-[4/3] w-full rounded-card object-cover"
        />
      ) : null}
      {preview.resolved && resolvedVideo ? (
        <p className="text-small text-ink-secondary">
          Shows {COURSE_PREVIEW.lengthSeconds} seconds of {resolvedVideo.lessonTitle}:{' '}
          {resolvedVideo.itemTitle}, from {formatPreviewStart(preview.resolved.startSeconds)}.
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <p className="text-small text-ink-secondary">{STATE_SENTENCE[preview.state]}</p>
        <Button
          type="button"
          size="sm"
          loading={busy}
          disabled={locked || busy || !(changed || makeClip)}
          onClick={onPress}
        >
          {makeClip ? 'Make clip' : 'Save preview'}
        </Button>
      </div>
    </Card>
  )
}
