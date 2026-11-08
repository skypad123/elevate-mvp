import { Tabs } from 'expo-router'
import { View } from 'react-native'
import { PillTabBar } from '@/components/PillTabBar'
import { TopNav } from '@/components/TopNav'
import { useBreakpoint } from '@/lib/responsive'
import { useSession } from '@/lib/session'

export default function TabsLayout() {
  const { isWideWeb } = useBreakpoint()
  const { isSignedIn } = useSession()
  return (
    <View style={{ flex: 1 }}>
      {isWideWeb ? <TopNav /> : null}
      <Tabs
        tabBar={() => (isWideWeb ? null : <PillTabBar />)}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
      >
        <Tabs.Screen name="index" options={{ title: 'Explore' }} />
        <Tabs.Protected guard={isSignedIn}>
          <Tabs.Screen name="learning" options={{ title: 'My Learning' }} />
          <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
        </Tabs.Protected>
      </Tabs>
    </View>
  )
}
