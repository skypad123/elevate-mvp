import type { PlaybackInfo } from '@elevate/core'
import { useEventListener } from 'expo'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useEffect } from 'react'
import { View } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'

export type VideoPlayback = Extract<PlaybackInfo, { kind: 'video' }>

export type VideoArtefactProps = {
  playback: VideoPlayback
  /** Resume position in seconds. */
  startAt?: number
  onProgress?: (positionSeconds: number) => void
  onEnded?: () => void
}

/** Native video via expo-video (HLS plays natively on iOS and Android). */
export function VideoArtefact({ playback, startAt = 0, onProgress, onEnded }: VideoArtefactProps) {
  const theme = useTheme()
  const source =
    playback.provider === 'mux'
      ? { uri: playback.hlsUrl, contentType: 'hls' as const }
      : { uri: playback.url }
  const player = useVideoPlayer(source, (p) => {
    p.timeUpdateEventInterval = 5
    if (startAt > 0) p.currentTime = startAt
  })

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    onProgress?.(Math.floor(currentTime))
  })
  useEventListener(player, 'playToEnd', () => {
    onEnded?.()
  })

  useEffect(() => {
    return () => {
      // the hook releases the player; nothing else to clean up
    }
  }, [])

  return (
    <View
      style={{
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: '#000',
        borderRadius: theme.radii.card,
        overflow: 'hidden',
      }}
    >
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        nativeControls
        fullscreenOptions={{ enable: true }}
        allowsPictureInPicture
        contentFit="contain"
      />
    </View>
  )
}
