import { Button, EmptyState, PageHeader, Skeleton } from '@elevate/web-ui'
import { errorMessage } from '@elevate/web-ui/portal'
import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { ChangeSetReview } from '../../components/change-set-review'
import { useChangeSet } from '../../lib/change-sets'
import { useCourseTree } from '../../lib/courses'
import { useCurrentProfile } from '../../lib/profile'

/**
 * `/p/:profileId/courses/:id/changes`: a writer's edits to a live course, waiting for the owner or
 * a manager. It reads the change set and both versions of the course, so each change can be shown
 * as it is live and as it would be.
 */
export function CourseChangesPage() {
  const { id = '' } = useParams()
  const { path } = useCurrentProfile()
  const navigate = useNavigate()
  const builder = path(`/courses/${id}`)
  const changeSet = useChangeSet(id)
  const live = useCourseTree(id, 'live')
  const draft = useCourseTree(id, 'draft', !!changeSet.data)

  const back = (
    <Link
      to={builder}
      className="mb-4 inline-flex items-center gap-1 text-small text-ink-secondary hover:text-ink"
    >
      <ArrowLeft className="size-4" /> Back to the course
    </Link>
  )

  if (changeSet.isPending || live.isPending) return <Skeleton className="h-96 w-full" />
  if (changeSet.isError || live.isError)
    return (
      <>
        {back}
        <EmptyState
          tone="danger"
          title="Could not load the changes"
          body={errorMessage(changeSet.error ?? live.error)}
        />
      </>
    )
  return (
    <>
      {back}
      <PageHeader
        eyebrow="Changes waiting for approval"
        title={live.data.title}
        description="Edits a writer made to this live course. Learners do not see them until they are approved."
      />
      {changeSet.data ? (
        <ChangeSetReview
          courseId={id}
          changeSet={changeSet.data}
          live={live.data}
          draft={draft.data}
          onDecided={() => navigate(builder)}
        />
      ) : (
        <EmptyState
          title="Nothing is waiting"
          body="This course has no changes waiting for approval."
          action={
            <Link to={builder}>
              <Button variant="secondary">Open the course</Button>
            </Link>
          }
        />
      )}
    </>
  )
}
