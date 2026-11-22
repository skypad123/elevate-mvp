import type { MessageKey } from '@elevate/i18n'
import { Link } from 'expo-router'
import { ArrowLeft, ArrowUpRight } from 'lucide-react-native'
import { Linking, Platform, Pressable, View } from 'react-native'
import { TAB_BAR_HEIGHT } from '@/components/PillTabBar'
import { usePreferences } from '@/lib/preferences'
import { useBreakpoint } from '@/lib/responsive'
import { teachUrl } from '@/lib/web-url'
import { useTheme } from '@/theme/ThemeProvider'
import { Button, Card, Screen, Text } from '@/ui'

const STEPS = [
  'learnerTeach.screen.how.step1',
  'learnerTeach.screen.how.step2',
  'learnerTeach.screen.how.step3',
  'learnerTeach.screen.how.step4',
  'learnerTeach.screen.how.step5',
  'learnerTeach.screen.how.step6',
] as const satisfies readonly MessageKey[]

/**
 * What teaching on Elevate involves, before anyone leaves the app. Its button opens Teach in the
 * language the app is showing: in this tab on the web, and in the phone's own browser on native,
 * where a Teach sign-in stays for the next visit. Open to everyone, signed in or out.
 */
export default function TeachScreen() {
  const theme = useTheme()
  const { isWideWeb } = useBreakpoint()
  const { locale, t } = usePreferences()

  function openTeach() {
    const url = `${teachUrl('/')}?lang=${locale}`
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.location.assign(url)
      return
    }
    Linking.openURL(url).catch(() => {})
  }

  return (
    <Screen maxWidth={720} bottomInset={isWideWeb ? 0 : TAB_BAR_HEIGHT}>
      <View style={{ gap: theme.space[6] }}>
        {/* Back to the Explore already in the stack, rather than a second copy of it */}
        <Link href="/" dismissTo asChild>
          <Pressable
            testID="teach-back"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
          >
            <ArrowLeft size={16} color={theme.colors.inkSecondary} />
            <Text variant="small" tone="secondary">
              {t('nav.explore')}
            </Text>
          </Pressable>
        </Link>

        <View style={{ gap: theme.space[3] }}>
          <Text variant="h1">{t('learnerTeach.screen.title')}</Text>
          <Text variant="bodyLg" tone="secondary">
            {t('learnerTeach.screen.intro')}
          </Text>
        </View>

        <Card style={{ gap: theme.space[2] }}>
          <Text variant="h3">{t('learnerTeach.screen.who.title')}</Text>
          <Text tone="secondary">{t('learnerTeach.screen.who.body')}</Text>
        </Card>

        <Card style={{ gap: theme.space[3] }}>
          <Text variant="h3">{t('learnerTeach.screen.how.title')}</Text>
          <View style={{ gap: theme.space[3] }}>
            {STEPS.map((key, i) => (
              <View key={key} style={{ flexDirection: 'row', gap: theme.space[3] }}>
                <Text variant="bodyStrong" tone="brand" style={{ minWidth: 20 }}>
                  {`${i + 1}.`}
                </Text>
                <Text tone="secondary" style={{ flex: 1 }}>
                  {t(key)}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <Card style={{ gap: theme.space[2] }}>
          <Text variant="h3">{t('learnerTeach.screen.fee.title')}</Text>
          <Text tone="secondary">{t('learnerTeach.screen.fee.body')}</Text>
        </Card>

        <View style={{ gap: theme.space[3], alignItems: 'flex-start' }}>
          <Text variant="small" tone="secondary">
            {t('learnerTeach.screen.signInNote')}
          </Text>
          <Button
            label={t('learnerTeach.screen.action')}
            iconRight={ArrowUpRight}
            onPress={openTeach}
            testID="teach-open"
          />
        </View>
      </View>
    </Screen>
  )
}
