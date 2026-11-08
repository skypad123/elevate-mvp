import { useLocalSearchParams, useRouter } from 'expo-router'
import { PlayCircle } from 'lucide-react-native'
import { EmptyState, Screen } from '@/ui'

export default function LearnPlaceholder() {
  const { enrollmentId } = useLocalSearchParams<{ enrollmentId: string }>()
  const router = useRouter()
  return (
    <Screen maxWidth={640}>
      <EmptyState
        icon={PlayCircle}
        eyebrow="Enrolment"
        title="The lesson player arrives in the next phase"
        body={`Enrolment ${enrollmentId} is active. Lessons, progress and quizzes land in Phase 7.`}
        action={{ label: 'Back to My Learning', onPress: () => router.replace('/learning') }}
      />
    </Screen>
  )
}
