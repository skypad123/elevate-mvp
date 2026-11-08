import MuxPlayer from '@mux/mux-player-react'
import { useEffect, useRef } from 'react'
import { View, type ViewStyle } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'
import type { VideoArtefactProps } from './VideoArtefact'

export type { VideoArtefactProps, VideoPlayback } from './VideoArtefact'

/**
 * Web video. expo-video on web has no HLS, so Mux assets play through Mux Player (hls.js inside)
 * and local MP4s through a plain <video>.
 */
export function VideoArtefact({ playback, startAt = 0, onProgress, onEnded }: VideoArtefactProps) {
  const theme = useTheme()
  const lastSent = useRef(-1)
  const videoRef = useRef<HTMLVideoElement>(null)

  const report = (seconds: number) => {
    const whole = Math.floor(seconds)
    if (whole !== lastSent.current && whole % 5 === 0) {
      lastSent.current = whole
      onProgress?.(whole)
    }
  }

  useEffect(() => {
    const el = videoRef.current
    if (el && startAt > 0) el.currentTime = startAt
  }, [startAt])

  const frame: ViewStyle = {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    borderRadius: theme.radii.card,
    overflow: 'hidden',
  }

  if (playback.provider === 'mux') {
    return (
      <View style={frame}>
        <MuxPlayer
          playbackId={playback.playbackId}
          tokens={{ playback: playback.tokens.playback, thumbnail: playback.tokens.thumbnail }}
          streamType="on-demand"
          startTime={startAt}
          accentColor={theme.colors.brand}
          onTimeUpdate={(e) => report((e.target as HTMLMediaElement).currentTime)}
          onEnded={() => onEnded?.()}
          style={{ width: '100%', height: '100%' }}
        />
      </View>
    )
  }

  return (
    <View style={frame}>
      <video
        ref={videoRef}
        src={playback.url}
        controls
        playsInline
        preload="metadata"
        style={{ width: '100%', height: '100%', display: 'block' }}
        onTimeUpdate={(e) => report(e.currentTarget.currentTime)}
        onEnded={() => onEnded?.()}
      >
        <track kind="captions" />
      </video>
    </View>
  )
}
