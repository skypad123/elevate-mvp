import { Link } from 'expo-router'
import { Compass } from 'lucide-react-native'
import { View } from 'react-native'
import { useT } from '@/lib/preferences'
import { Button, EmptyState, Screen } from '@/ui'

export default function NotFound() {
  const t = useT()
  return (
    <Screen>
      <EmptyState
        icon={Compass}
        eyebrow="404"
        title={t('learnerCommon.notFound.title')}
        body={t('learnerCommon.notFound.body')}
      />
      <View style={{ marginTop: 16, alignItems: 'center' }}>
        <Link href="/" asChild>
          <Button label={t('learnerCommon.notFound.back')} variant="ghost" />
        </Link>
      </View>
    </Screen>
  )
}
