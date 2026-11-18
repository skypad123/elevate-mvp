import { router } from 'expo-router'
import { View } from 'react-native'
import { usePreferences } from '@/lib/preferences'
import { useSession } from '@/lib/session'
import { isProfileOwner } from '@/lib/teach-banner'
import { useTheme } from '@/theme/ThemeProvider'
import { Button, Card, Text } from '@/ui'

/**
 * "Teach on Elevate" on the Profile tab: the way back to `/teach` after the Explore banner was
 * closed. Hidden from owners of a teaching profile, as the banner is; closing the banner doesn't
 * hide it.
 */
export function TeachProfileRow() {
  const theme = useTheme()
  const { t } = usePreferences()
  const { user } = useSession()
  if (isProfileOwner(user)) return null
  return (
    <Card style={{ gap: theme.space[3] }}>
      <View style={{ gap: 4 }}>
        <Text variant="h3">{t('learnerTeach.profile.title')}</Text>
        <Text tone="secondary">{t('learnerTeach.profile.body')}</Text>
      </View>
      <Button
        label={t('learnerTeach.profile.action')}
        variant="secondary"
        onPress={() => router.push('/teach')}
        testID="profile-teach-open"
      />
    </Card>
  )
}
