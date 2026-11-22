import { describe, expect, it } from 'vitest'
import {
  allowedStarts,
  COURSE_PREVIEW,
  formatPreviewStart,
  type PreviewSetting,
  type PreviewVideo,
  previewChangesLeft,
  previewIsShown,
  previewState,
  resolvePreview,
} from '../src/domain/course-preview'

const on: PreviewSetting = { enabled: true, mediaId: null, startSeconds: null }
const video = (mediaId: string, durationSeconds: number | null = 60, usable = true) =>
  ({ mediaId, durationSeconds, usable }) satisfies PreviewVideo

describe('resolvePreview', () => {
  it('gives nothing when the preview is off', () => {
    expect(resolvePreview({ ...on, enabled: false }, [video('a')])).toBeNull()
  })

  it('gives nothing with no video, or only unusable ones', () => {
    expect(resolvePreview(on, [])).toBeNull()
    expect(resolvePreview(on, [video('a', 60, false), video('b', 3, false)])).toBeNull()
  })

  it('defaults to the first usable video, skipping an unusable one before it', () => {
    expect(resolvePreview(on, [video('a', 60, false), video('b'), video('c')])).toEqual({
      mediaId: 'b',
      startSeconds: 10,
    })
  })

  it('uses a chosen video that is usable', () => {
    expect(resolvePreview({ ...on, mediaId: 'c' }, [video('b'), video('c')])).toEqual({
      mediaId: 'c',
      startSeconds: 10,
    })
  })

  it('falls back to the default for a chosen video not on the course, or not usable', () => {
    expect(resolvePreview({ ...on, mediaId: 'gone' }, [video('b')])?.mediaId).toBe('b')
    expect(
      resolvePreview({ ...on, mediaId: 'c' }, [video('b'), video('c', 60, false)])?.mediaId,
    ).toBe('b')
  })

  it('starts the default clip at 10 for a 15-second video and at 0 for a 14-second one', () => {
    expect(resolvePreview(on, [video('a', 15)])?.startSeconds).toBe(10)
    expect(resolvePreview(on, [video('a', 14)])?.startSeconds).toBe(0)
  })

  it('lowers a chosen start to the last allowed start', () => {
    const chosen = { ...on, mediaId: 'a', startSeconds: 90 }
    expect(resolvePreview(chosen, [video('a', 100)])?.startSeconds).toBe(90)
    expect(resolvePreview(chosen, [video('a', 93)])?.startSeconds).toBe(80)
    expect(resolvePreview(chosen, [video('a', 5)])?.startSeconds).toBe(0)
  })

  it('drops a chosen start when the chosen video is not usable', () => {
    expect(
      resolvePreview({ ...on, mediaId: 'c', startSeconds: 90 }, [
        video('b', 200),
        video('c', 200, false),
      ]),
    ).toEqual({ mediaId: 'b', startSeconds: 10 })
  })

  it('applies a chosen start with no chosen video to the default video', () => {
    expect(resolvePreview({ ...on, startSeconds: 30 }, [video('b'), video('c')])).toEqual({
      mediaId: 'b',
      startSeconds: 30,
    })
  })

  it('counts a video on two items once, at its first place', () => {
    expect(
      resolvePreview(on, [video('a', 60, false), video('a', 60, true), video('b')])?.mediaId,
    ).toBe('b')
  })

  it('always returns one of the video allowed starts', () => {
    for (const duration of [5, 9, 14, 15, 37, 60, 93, 105]) {
      for (const start of [null, 0, 10, 40, 90, 1000]) {
        const r = resolvePreview({ ...on, startSeconds: start }, [video('a', duration)])
        expect(allowedStarts(duration)).toContain(r?.startSeconds)
      }
    }
  })
})

describe('previewChangesLeft', () => {
  it('pins the allowance at 5 and never goes below 0', () => {
    expect(COURSE_PREVIEW.maxClipsPerVideo).toBe(5)
    expect(previewChangesLeft(0)).toBe(5)
    expect(previewChangesLeft(5)).toBe(0)
    expect(previewChangesLeft(7)).toBe(0)
  })
})

describe('allowedStarts', () => {
  it('steps by 10 while the clip ends a second before the video does', () => {
    expect(allowedStarts(60)).toEqual([0, 10, 20, 30, 40, 50])
    const long = allowedStarts(105)
    expect(long).toHaveLength(11)
    expect(long.at(-1)).toBe(100)
    const lecture = allowedStarts(1200)
    expect(lecture).toHaveLength(120)
    expect(lecture.at(-1)).toBe(1190)
    expect(allowedStarts(5)).toEqual([0])
  })
})

describe('formatPreviewStart', () => {
  it('shows minutes and seconds, and hours from an hour', () => {
    expect(formatPreviewStart(10)).toBe('0:10')
    expect(formatPreviewStart(95)).toBe('1:35')
    expect(formatPreviewStart(3725)).toBe('1:02:05')
  })
})

describe('previewIsShown', () => {
  const all = { enabled: true, previewKey: 'k', sourceMediaId: 'm', previewsOn: true }
  it('is true only when all four conditions hold', () => {
    expect(previewIsShown(all)).toBe(true)
    expect(previewIsShown({ ...all, enabled: false })).toBe(false)
    expect(previewIsShown({ ...all, previewKey: null })).toBe(false)
    expect(previewIsShown({ ...all, sourceMediaId: null })).toBe(false)
    expect(previewIsShown({ ...all, previewsOn: false })).toBe(false)
  })
})

describe('previewState', () => {
  const resolved = { mediaId: 'a', startSeconds: 10 }
  const base = {
    setting: on,
    resolved,
    courseStatus: 'live',
    previewKey: 'k',
    source: resolved,
    previewsOn: true,
    changesLeft: 3,
  }

  it('is off when the setting is off, also while previews are paused', () => {
    expect(previewState({ ...base, setting: { ...on, enabled: false }, previewsOn: false })).toBe(
      'off',
    )
  })
  it('is paused when the configuration value is off', () => {
    expect(previewState({ ...base, previewsOn: false })).toBe('paused')
  })
  it('is no_video when nothing resolves', () => {
    expect(previewState({ ...base, resolved: null, changesLeft: 0 })).toBe('no_video')
  })
  it('is not_live for a course that is not live', () => {
    expect(previewState({ ...base, courseStatus: 'draft', previewKey: null, source: null })).toBe(
      'not_live',
    )
  })
  it('is ready when the stored clip matches, even with no changes left', () => {
    expect(previewState(base)).toBe('ready')
    expect(previewState({ ...base, changesLeft: 0 })).toBe('ready')
  })
  it('is limit when the clip does not match and no changes are left', () => {
    expect(
      previewState({ ...base, source: { mediaId: 'a', startSeconds: 20 }, changesLeft: 0 }),
    ).toBe('limit')
  })
  it('is pending when a clip is missing or out of date', () => {
    expect(previewState({ ...base, previewKey: null, source: null })).toBe('pending')
    expect(previewState({ ...base, source: { mediaId: 'b', startSeconds: 10 } })).toBe('pending')
    // A key with no source is a hidden leftover, not a clip.
    expect(previewState({ ...base, source: null })).toBe('pending')
  })
})
