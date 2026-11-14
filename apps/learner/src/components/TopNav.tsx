import { Link, usePathname } from 'expo-router'
import { Pressable, View } from 'react-native'
import { useT } from '@/lib/preferences'
import { useSession } from '@/lib/session'
import { useTheme } from '@/theme/ThemeProvider'
import { Avatar } from '@/ui/Avatar'
import { Button } from '@/ui/Button'
import { Logo } from '@/ui/Logo'
import { Text } from '@/ui/Text'

export const TOP_NAV_HEIGHT = 68

/** Wide-web navigation: wordmark · Explore · My Learning · avatar. */
export function TopNav() {
  const theme = useTheme()
  const pathname = usePathname()
  const { isSignedIn, user } = useSession()
  const t = useT()

  const link = (href: '/' | '/learning', label: string, active: boolean) => (
    <Link href={href} asChild>
      <Pressable
        style={{
          paddingHorizontal: 14,
          height: 40,
          justifyContent: 'center',
          borderRadius: theme.radii.control,
          backgroundColor: active ? theme.colors.brandTint : 'transparent',
        }}
      >
        <Text variant="smallStrong" tone={active ? 'brand' : 'secondary'}>
          {label}
        </Text>
      </Pressable>
    </Link>
  )

  return (
    <View
      style={{
        height: TOP_NAV_HEIGHT,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        backgroundColor: theme.colors.canvas,
      }}
    >
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.space[8],
          maxWidth: theme.layout.contentMaxWidth + theme.space[8] * 2,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <Link href="/" asChild>
          <Pressable>
            <Logo size="sm" />
          </Pressable>
        </Link>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {link('/', t('nav.explore'), pathname === '/' || pathname.startsWith('/course'))}
          {isSignedIn
            ? link('/learning', t('nav.myLearning'), pathname.startsWith('/learn'))
            : null}
          {isSignedIn ? (
            <Link href="/profile" asChild>
              <Pressable style={{ marginLeft: 12 }} accessibilityLabel={t('nav.profile')}>
                <Avatar name={user?.name ?? user?.email} url={user?.avatarUrl} size={36} />
              </Pressable>
            </Link>
          ) : (
            <Link href="/sign-in" asChild>
              <Button label={t('nav.signIn')} size="sm" variant="secondary" />
            </Link>
          )}
        </View>
      </View>
    </View>
  )
}
