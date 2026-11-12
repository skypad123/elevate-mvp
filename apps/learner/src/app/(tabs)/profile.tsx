import { LogOut } from 'lucide-react-native'
import { useState } from 'react'
import { View } from 'react-native'
import { TAB_BAR_HEIGHT } from '@/components/PillTabBar'
import { api } from '@/lib/api'
import { errorMessage, unwrap } from '@/lib/api-error'
import { useBreakpoint } from '@/lib/responsive'
import { useSession } from '@/lib/session'
import { useTheme } from '@/theme/ThemeProvider'
import { Avatar, Badge, Button, Card, Input, Screen, Text } from '@/ui'

export default function Profile() {
  const theme = useTheme()
  const { isWideWeb } = useBreakpoint()
  const { user, signOut, refreshUser } = useSession()
  const [name, setName] = useState(user?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      await unwrap(await api.me.$patch({ json: { name: name.trim() } }))
      await refreshUser()
      setMessage({ tone: 'success', text: 'Saved' })
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
            <Text variant="h2">{user?.name ?? 'Your profile'}</Text>
            <Text tone="secondary">{user?.email}</Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Badge label="Learner" tone="brand" />
              {user?.profiles.length ? <Badge label="Teacher" tone="accent" /> : null}
              {user?.roles.some((r) => r === 'support_agent' || r === 'super_admin') ? (
                <Badge label="Staff" tone="info" />
              ) : null}
            </View>
          </View>
        </View>

        <Card style={{ gap: theme.space[4] }}>
          <Text variant="h3">Display name</Text>
          <Text tone="secondary" variant="small">
            This is the name printed on your certificates.
          </Text>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoCapitalize="words"
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
            <Button
              label="Save"
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

        <Card style={{ gap: theme.space[3] }}>
          <Text variant="h3">Account</Text>
          <Button label="Sign out" variant="secondary" icon={LogOut} onPress={signOut} />
        </Card>
      </View>
    </Screen>
  )
}
