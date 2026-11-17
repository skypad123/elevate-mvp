import { localeNames, supportedLocales } from '@elevate/i18n'
import { View } from 'react-native'
import { usePreferences } from '@/lib/preferences'
import { useSession } from '@/lib/session'
import { useTheme } from '@/theme/ThemeProvider'
import { Chip } from '@/ui/Chip'

/**
 * English or 中文, for a visitor who has not signed in yet (Explore and sign-in). Each name is in
 * its own language. The selected chip is the language on screen; a press stores the choice on the
 * device, and on the account when signed in. Profile has its own row, with "Follow device".
 */
export function LanguageSwitch() {
  const { locale, t } = usePreferences()
  const { chooseLocale } = useSession()
  const { space } = useTheme()
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('learnerCommon.language.label')}
      style={{ flexDirection: 'row', gap: space[2], flexWrap: 'wrap' }}
    >
      {supportedLocales.map((option) => (
        <Chip
          key={option}
          role="radio"
          testID={`lang-${option}`}
          lang={option}
          label={localeNames[option]}
          selected={locale === option}
          onPress={() => void chooseLocale(option)}
        />
      ))}
    </View>
  )
}
