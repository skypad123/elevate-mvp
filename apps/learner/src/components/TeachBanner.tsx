import { router } from 'expo-router'
import { X } from 'lucide-react-native'
import { View } from 'react-native'
import { usePreferences } from '@/lib/preferences'
import { useTheme } from '@/theme/ThemeProvider'
import { Button, Card, IconButton, Text } from '@/ui'

/**
 * The invitation to teach at the end of Explore. It opens `/teach`; Explore decides when it shows
 * (`useTeachBanner`) and what closing it does.
 */
export function TeachBanner({ onDismiss }: { onDismiss: () => void }) {
  const theme = useTheme()
  const { t } = usePreferences()
  return (
    <Card muted style={{ gap: theme.space[4] }} testID="teach-banner">
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.space[3] }}>
        <View style={{ flex: 1, gap: theme.space[2] }}>
          <Text variant="h3">{t('learnerTeach.banner.title')}</Text>
          <Text tone="secondary">{t('learnerTeach.banner.body')}</Text>
        </View>
        <IconButton
          icon={X}
          label={t('learnerTeach.banner.close')}
          size={36}
          onPress={onDismiss}
          testID="teach-banner-close"
        />
      </View>
      <View style={{ alignItems: 'flex-start' }}>
        <Button
          label={t('learnerTeach.banner.action')}
          variant="secondary"
          onPress={() => router.push('/teach')}
          testID="teach-banner-open"
        />
      </View>
    </Card>
  )
}
