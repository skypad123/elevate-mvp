import { Check, Lock, Play } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'
import { Text } from '@/ui/Text'

export type TrailStatus = 'locked' | 'available' | 'in_progress' | 'completed'

export type TrailItem = {
  id: string
  title: string
  summary?: string | null
  meta?: string
  status?: TrailStatus
  requires?: string[]
}

/** The course "trail": lessons as an ascending path of nodes, used on course pages and in the player. */
export function Trail({
  items,
  onPress,
  activeId,
}: {
  items: TrailItem[]
  onPress?: (item: TrailItem) => void
  activeId?: string | null
}) {
  const theme = useTheme()
  return (
    <View>
      {items.map((item, index) => {
        const status = item.status ?? 'available'
        const last = index === items.length - 1
        const nodeColor =
          status === 'completed'
            ? theme.colors.brand
            : status === 'locked'
              ? theme.colors.surfaceSunken
              : status === 'in_progress'
                ? theme.colors.accent
                : theme.colors.surface
        const nodeBorder =
          status === 'locked'
            ? theme.colors.border
            : status === 'in_progress'
              ? theme.colors.accent
              : theme.colors.brand
        const content = (
          <View style={{ flexDirection: 'row', gap: theme.space[4] }}>
            <View style={{ alignItems: 'center', width: 32 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: nodeColor,
                  borderWidth: 2,
                  borderColor: nodeBorder,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {status === 'completed' ? (
                  <Check size={16} color={theme.colors.brandInk} strokeWidth={3} />
                ) : status === 'locked' ? (
                  <Lock size={14} color={theme.colors.inkTertiary} />
                ) : status === 'in_progress' ? (
                  <Play size={14} color={theme.colors.accentInk} fill={theme.colors.accentInk} />
                ) : (
                  <Text variant="smallStrong" tone="brand">
                    {index + 1}
                  </Text>
                )}
              </View>
              {!last ? (
                <View
                  style={{
                    flex: 1,
                    width: 2,
                    backgroundColor:
                      status === 'completed' ? theme.colors.brand : theme.colors.border,
                    marginVertical: 4,
                  }}
                />
              ) : null}
            </View>
            <View style={{ flex: 1, paddingBottom: last ? 0 : theme.space[6], gap: 4 }}>
              <Text
                variant="h3"
                tone={status === 'locked' ? 'tertiary' : 'ink'}
                style={activeId === item.id ? { color: theme.colors.brand } : undefined}
              >
                {item.title}
              </Text>
              {item.summary ? (
                <Text variant="small" tone="secondary">
                  {item.summary}
                </Text>
              ) : null}
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: theme.space[2],
                  alignItems: 'center',
                }}
              >
                {item.meta ? (
                  <Text variant="caption" tone="tertiary">
                    {item.meta}
                  </Text>
                ) : null}
                {item.requires?.length ? (
                  <Text variant="caption" tone="tertiary">
                    · after {item.requires.join(', ')}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        )
        if (!onPress || status === 'locked') return <View key={item.id}>{content}</View>
        return (
          <Pressable
            key={item.id}
            onPress={() => onPress(item)}
            accessibilityRole="button"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            {content}
          </Pressable>
        )
      })}
    </View>
  )
}
