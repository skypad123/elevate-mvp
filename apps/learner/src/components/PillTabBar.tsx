import { Link, usePathname } from 'expo-router'
import { Compass, GraduationCap, LogIn, type LucideIcon, UserRound } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSession } from '@/lib/session'
import { useTheme } from '@/theme/ThemeProvider'
import { Text } from '@/ui/Text'

type Item = {
  href: '/' | '/learning' | '/profile' | '/sign-in'
  label: string
  icon: LucideIcon
  match: (p: string) => boolean
}

export const TAB_BAR_HEIGHT = 64

export function PillTabBar() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const pathname = usePathname()
  const { isSignedIn } = useSession()

  const items: Item[] = isSignedIn
    ? [
        {
          href: '/',
          label: 'Explore',
          icon: Compass,
          match: (p) => p === '/' || p.startsWith('/course'),
        },
        {
          href: '/learning',
          label: 'My Learning',
          icon: GraduationCap,
          match: (p) => p.startsWith('/learning') || p.startsWith('/learn'),
        },
        {
          href: '/profile',
          label: 'Profile',
          icon: UserRound,
          match: (p) => p.startsWith('/profile'),
        },
      ]
    : [
        {
          href: '/',
          label: 'Explore',
          icon: Compass,
          match: (p) => p === '/' || p.startsWith('/course'),
        },
        { href: '/sign-in', label: 'Sign in', icon: LogIn, match: (p) => p.startsWith('/sign-in') },
      ]

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        paddingBottom: Math.max(insets.bottom, 12),
      }}
    >
      <View
        style={[
          {
            flexDirection: 'row',
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderWidth: 1,
            borderRadius: theme.radii.pill,
            padding: 6,
            gap: 4,
            marginHorizontal: 16,
          },
          theme.shadow,
        ]}
      >
        {items.map((item) => {
          const active = item.match(pathname)
          return (
            <Link key={item.href} href={item.href} asChild>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 16,
                  height: 44,
                  borderRadius: theme.radii.pill,
                  backgroundColor: active ? theme.colors.brandTint : 'transparent',
                }}
              >
                <item.icon
                  size={20}
                  color={active ? theme.colors.brand : theme.colors.inkSecondary}
                  strokeWidth={2}
                />
                {active ? (
                  <Text variant="smallStrong" tone="brand">
                    {item.label}
                  </Text>
                ) : null}
              </Pressable>
            </Link>
          )
        })}
      </View>
    </View>
  )
}
