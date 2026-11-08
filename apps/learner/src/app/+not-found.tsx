import { Link } from 'expo-router'
import { Compass } from 'lucide-react-native'
import { View } from 'react-native'
import { Button, EmptyState, Screen } from '@/ui'

export default function NotFound() {
  return (
    <Screen>
      <EmptyState
        icon={Compass}
        eyebrow="404"
        title="That page is not on the map"
        body="The link may be old, or the course may have been taken down."
      />
      <View style={{ marginTop: 16, alignItems: 'center' }}>
        <Link href="/" asChild>
          <Button label="Back to Explore" variant="ghost" />
        </Link>
      </View>
    </Screen>
  )
}
