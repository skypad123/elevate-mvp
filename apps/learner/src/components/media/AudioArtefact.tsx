import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { Pause, Play, RotateCcw } from 'lucide-react-native'
import { useEffect, useRef } from 'react'
import { Pressable, View } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'
import { ProgressBar } from '@/ui/ProgressBar'
import { Text } from '@/ui/Text'

export type AudioArtefactProps = {
  url: string
  title: string
  startAt?: number
  onProgress?: (positionSeconds: number) => void
  onEnded?: () => void
}

const fmt = (s: number) => {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

/** Audio lessons: MP3/AAC served from storage, played with expo-audio on every platform. */
export function AudioArtefact({
  url,
  title,
  startAt = 0,
  onProgress,
  onEnded,
}: AudioArtefactProps) {
  const theme = useTheme()
  const player = useAudioPlayer({ uri: url })
  const status = useAudioPlayerStatus(player)
  const lastSent = useRef(-1)
  const seeded = useRef(false)

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {})
  }, [])

  useEffect(() => {
    if (status.isLoaded && !seeded.current && startAt > 0) {
      seeded.current = true
      player.seekTo(startAt).catch(() => {})
    }
  }, [status.isLoaded, startAt, player])

  useEffect(() => {
    const whole = Math.floor(status.currentTime)
    if (status.playing && whole !== lastSent.current && whole % 5 === 0) {
      lastSent.current = whole
      onProgress?.(whole)
    }
  }, [status.currentTime, status.playing, onProgress])

  useEffect(() => {
    if (status.didJustFinish) onEnded?.()
  }, [status.didJustFinish, onEnded])

  const duration = status.duration || 0
  const percent = duration ? (status.currentTime / duration) * 100 : 0

  return (
    <View
      style={{
        gap: theme.space[3],
        padding: theme.space[5],
        borderRadius: theme.radii.card,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
      }}
    >
      <Text variant="eyebrow" tone="tertiary">
        Audio lesson
      </Text>
      <Text variant="h3">{title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={status.playing ? 'Pause' : 'Play'}
          onPress={() => (status.playing ? player.pause() : player.play())}
          style={{
            width: 52,
            height: 52,
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.brand,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {status.playing ? (
            <Pause size={22} color={theme.colors.brandInk} />
          ) : (
            <Play size={22} color={theme.colors.brandInk} style={{ marginLeft: 3 }} />
          )}
        </Pressable>
        <View style={{ flex: 1, gap: 6 }}>
          <ProgressBar percent={percent} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="caption" tone="tertiary">
              {fmt(status.currentTime)}
            </Text>
            <Text variant="caption" tone="tertiary">
              {fmt(duration)}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Restart"
          onPress={() => player.seekTo(0).catch(() => {})}
          hitSlop={8}
        >
          <RotateCcw size={18} color={theme.colors.inkSecondary} />
        </Pressable>
      </View>
    </View>
  )
}
