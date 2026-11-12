import { supportedLocales, themePreferenceSchema } from '@elevate/core'
import { localeNames } from '@elevate/i18n'
import { LogOut } from 'lucide-react-native'
import { useState } from 'react'
import { View } from 'react-native'
import { TAB_BAR_HEIGHT } from '@/components/PillTabBar'
import { api } from '@/lib/api'
import { errorMessage, unwrap } from '@/lib/api-error'
import { usePreferences } from '@/lib/preferences'
import { useBreakpoint } from '@/lib/responsive'
import { useSession } from '@/lib/session'
import { useTheme } from '@/theme/ThemeProvider'
import { Avatar, Badge, Button, Card, Chip, Input, Screen, Text } from '@/ui'

export default function Profile() {
  const theme = useTheme()
  const { isWideWeb } = useBreakpoint()
  const { user, signOut, refreshUser } = useSession()
  const { preferences, setPreference, t } = usePreferences()
  const [name, setName] = useState(user?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      await unwrap(await api.me.$patch({ json: { name: name.trim() } }))
      await refreshUser()
      setMessage({ tone: 'success', text: t('profile.saved') })
    } catch (e) {
      setMessage({ tone: 'danger', text: errorMessage(e) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Screen maxWidth={720} bottomInset={isWideWeb ? 0 : TAB_BAR_HEIGHT}>
      <View style={{ gap: theme.space[6] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[4] }}>
          <Avatar name={user?.name ?? user?.email} url={user?.avatarUrl} size={64} />
          <View style={{ gap: 4, flex: 1 }}>
            <Text variant="h2">{user?.name ?? t('profile.title')}</Text>
            <Text tone="secondary">{user?.email}</Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Badge label={t('role.learner')} tone="brand" />
              {user?.profiles.length ? <Badge label={t('role.teacher')} tone="accent" /> : null}
              {user?.roles.some((r) => r === 'support_agent' || r === 'super_admin') ? (
                <Badge label={t('role.staff')} tone="info" />
              ) : null}
            </View>
          </View>
        </View>

        <Card style={{ gap: theme.space[4] }}>
          <Text variant="h3">{t('profile.displayName')}</Text>
          <Text tone="secondary" variant="small">
            {t('profile.displayName.hint')}
          </Text>
          <Input
            value={name}
            onChangeText={setName}
            placeholder={t('profile.name.placeholder')}
            autoCapitalize="words"
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
            <Button
              label={t('profile.save')}
              onPress={save}
              loading={saving}
              disabled={!name.trim() || name.trim() === (user?.name ?? '')}
            />
            {message ? (
              <Text variant="small" tone={message.tone}>
                {message.text}
              </Text>
            ) : null}
          </View>
        </Card>

        {/* Preferences: add a row here when a field joins preferencesSchema in @elevate/core. */}
        <Card style={{ gap: theme.space[4] }}>
          <View style={{ gap: 4 }}>
            <Text variant="h3">{t('prefs.title')}</Text>
            <Text tone="secondary" variant="small">
              {t('prefs.description')}
            </Text>
          </View>
          <View style={{ gap: theme.space[2] }}>
            <Text variant="smallStrong">{t('prefs.appearance')}</Text>
            <Text tone="secondary" variant="small">
              {t('prefs.appearance.description')}
            </Text>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={t('prefs.appearance')}
              style={{ flexDirection: 'row', gap: theme.space[2], flexWrap: 'wrap' }}
            >
              {themePreferenceSchema.options.map((option) => (
                <Chip
                  key={option}
                  role="radio"
                  label={t(`prefs.theme.${option}`)}
                  selected={preferences.theme === option}
                  onPress={() => setPreference('theme', option)}
                />
              ))}
            </View>
          </View>
          <View style={{ gap: theme.space[2] }}>
            <Text variant="smallStrong">{t('prefs.language')}</Text>
            <Text tone="secondary" variant="small">
              {t('prefs.language.description')}
            </Text>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={t('prefs.language')}
              style={{ flexDirection: 'row', gap: theme.space[2], flexWrap: 'wrap' }}
            >
              {supportedLocales.map((locale) => (
                <Chip
                  key={locale}
                  role="radio"
                  label={localeNames[locale]}
                  selected={preferences.locale === locale}
                  onPress={() => setPreference('locale', locale)}
                />
              ))}
            </View>
          </View>
        </Card>

        <Card style={{ gap: theme.space[3] }}>
          <Text variant="h3">{t('account.title')}</Text>
          <Button label={t('nav.signOut')} variant="secondary" icon={LogOut} onPress={signOut} />
        </Card>
      </View>
    </Screen>
  )
}
