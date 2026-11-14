import { Tabs } from 'expo-router'
import { View } from 'react-native'
import { PillTabBar } from '@/components/PillTabBar'
import { TopNav } from '@/components/TopNav'
import { useT } from '@/lib/preferences'
import { useBreakpoint } from '@/lib/responsive'
import { useSession } from '@/lib/session'

export default function TabsLayout() {
  const { isWideWeb } = useBreakpoint()
  const { isSignedIn } = useSession()
  const t = useT()
  return (
    <View style={{ flex: 1 }}>
      {isWideWeb ? <TopNav /> : null}
      <Tabs
        tabBar={() => (isWideWeb ? null : <PillTabBar />)}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
      >
        <Tabs.Screen name="index" options={{ title: t('nav.explore') }} />
        <Tabs.Protected guard={isSignedIn}>
          <Tabs.Screen name="learning" options={{ title: t('nav.myLearning') }} />
          <Tabs.Screen name="profile" options={{ title: t('nav.profile') }} />
        </Tabs.Protected>
      </Tabs>
    </View>
  )
}
