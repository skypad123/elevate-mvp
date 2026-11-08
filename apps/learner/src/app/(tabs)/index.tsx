import { Sparkles } from 'lucide-react-native'
import { View } from 'react-native'
import { TAB_BAR_HEIGHT } from '@/components/PillTabBar'
import { useBreakpoint } from '@/lib/responsive'
import { useTheme } from '@/theme/ThemeProvider'
import { Card, EmptyState, Screen, Skeleton, Text } from '@/ui'

export default function Explore() {
  const theme = useTheme()
  const { isWideWeb, isMd } = useBreakpoint()
  return (
    <Screen bottomInset={isWideWeb ? 0 : TAB_BAR_HEIGHT}>
      <View style={{ gap: theme.space[8] }}>
        <View style={{ gap: theme.space[3], maxWidth: 720 }}>
          <Text variant="eyebrow" tone="brand">
            Elevate
          </Text>
          <Text variant={isMd ? 'display' : 'h1'}>Learn a craft from people who practise it.</Text>
          <Text variant="bodyLg" tone="secondary">
            Short, serious courses by independent teachers in Singapore. Pay once, learn at your
            pace, earn a certificate you can verify.
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[5] }}>
          {['one', 'two', 'three'].map((slot) => (
            <Card
              key={slot}
              padded={false}
              style={{ flexBasis: isMd ? '31%' : '100%', flexGrow: 1 }}
            >
              <Skeleton height={160} radius={0} />
              <View style={{ padding: theme.space[4], gap: theme.space[2] }}>
                <Skeleton width="40%" height={12} />
                <Skeleton width="85%" height={20} />
                <Skeleton width="60%" height={14} />
              </View>
            </Card>
          ))}
        </View>
        <EmptyState
          icon={Sparkles}
          eyebrow="Coming next"
          title="The catalogue is on its way"
          body="Explore, search and course pages arrive in the next build phase."
        />
      </View>
    </Screen>
  )
}
