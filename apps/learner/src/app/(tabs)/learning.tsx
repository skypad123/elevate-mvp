import { GraduationCap } from 'lucide-react-native'
import { View } from 'react-native'
import { TAB_BAR_HEIGHT } from '@/components/PillTabBar'
import { useBreakpoint } from '@/lib/responsive'
import { useSession } from '@/lib/session'
import { useTheme } from '@/theme/ThemeProvider'
import { EmptyState, Screen, Text } from '@/ui'

export default function Learning() {
  const theme = useTheme()
  const { isWideWeb } = useBreakpoint()
  const { user } = useSession()
  return (
    <Screen bottomInset={isWideWeb ? 0 : TAB_BAR_HEIGHT}>
      <View style={{ gap: theme.space[6] }}>
        <View style={{ gap: theme.space[2] }}>
          <Text variant="eyebrow" tone="tertiary">
            My Learning
          </Text>
          <Text variant="h1">
            {user?.name ? `Welcome back, ${user.name.split(' ')[0]}.` : 'Welcome back.'}
          </Text>
        </View>
        <EmptyState
          icon={GraduationCap}
          title="Nothing in progress yet"
          body="Courses you enrol in will appear here with your progress and certificates."
        />
      </View>
    </Screen>
  )
}
