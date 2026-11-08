import Hls from 'hls.js'
import { useEffect, useRef } from 'react'
import { View, type ViewStyle } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'
import type { VideoArtefactProps } from './VideoArtefact'

export type { VideoArtefactProps, VideoPlayback } from './VideoArtefact'

/**
 * Web video. expo-video on web has no HLS, and Mux Player's web component does not survive
 * Metro's class transform, so Mux streams play through hls.js on a plain <video> (Safari uses its
 * native HLS support) and local files play as MP4.
 */
export function VideoArtefact({ playback, startAt = 0, onProgress, onEnded }: VideoArtefactProps) {
  const theme = useTheme()
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastSent = useRef(-1)
  const src = playback.provider === 'mux' ? playback.hlsUrl : playback.url
  const isHls = playback.provider === 'mux'
  const poster =
    playback.provider === 'mux' ? playback.thumbnailUrl : (playback.thumbnailUrl ?? undefined)

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    let hls: Hls | null = null
    if (isHls && !el.canPlayType('application/vnd.apple.mpegurl') && Hls.isSupported()) {
      hls = new Hls({ startPosition: startAt > 0 ? startAt : -1 })
      hls.loadSource(src)
      hls.attachMedia(el)
    } else {
      el.src = src
      if (startAt > 0) {
        const seek = () => {
          el.currentTime = startAt
          el.removeEventListener('loadedmetadata', seek)
        }
        el.addEventListener('loadedmetadata', seek)
      }
    }
    return () => {
      hls?.destroy()
    }
  }, [src, isHls, startAt])

  const report = (seconds: number) => {
    const whole = Math.floor(seconds)
    if (whole !== lastSent.current && whole % 5 === 0) {
      lastSent.current = whole
      onProgress?.(whole)
    }
  }

  const frame: ViewStyle = {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    borderRadius: theme.radii.card,
    overflow: 'hidden',
  }

  return (
    <View style={frame}>
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        poster={poster ?? undefined}
        style={{ width: '100%', height: '100%', display: 'block' }}
        onTimeUpdate={(e) => report(e.currentTarget.currentTime)}
        onEnded={() => onEnded?.()}
      >
        <track kind="captions" />
      </video>
    </View>
  )
}
