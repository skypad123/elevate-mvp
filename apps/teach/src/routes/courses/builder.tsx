import { COURSE_CATEGORIES } from '@elevate/core'
import {
  Badge,
  EmptyState,
  formatDate,
  PageHeader,
  Skeleton,
  statusLabel,
  statusTone,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@elevate/web-ui'
import { errorMessage } from '@elevate/web-ui/portal'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router'
import { CurriculumEditor } from '../../components/curriculum-editor'
import { DetailsForm } from '../../components/details-form'
import { PrerequisitesEditor } from '../../components/prerequisites-editor'
import { ReviewPanel } from '../../components/review-panel'
import { useCourse } from '../../lib/courses'
import { useCurrentProfile } from '../../lib/profile'
import { SaveIndicator, SaveTrackerProvider } from '../../lib/save-tracker'

type Tab = 'curriculum' | 'map' | 'details' | 'review'
const TABS: Tab[] = ['curriculum', 'map', 'details', 'review']

export function CourseBuilder() {
  const { id = '' } = useParams()
  const { path } = useCurrentProfile()
  const course = useCourse(id)
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t === params.get('tab')) ?? 'curriculum') as Tab
  const setTab = (next: string) => setParams({ tab: next }, { replace: true })

  if (course.isPending) return <Skeleton className="h-96 w-full" />
  if (course.isError)
    return (
      <EmptyState tone="danger" title="Could not load course" body={errorMessage(course.error)} />
    )
  const c = course.data
  const locked = c.status === 'pending_review'

  return (
    <SaveTrackerProvider>
      <Link
        to={path('/courses')}
        className="mb-4 inline-flex items-center gap-1 text-small text-ink-secondary hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Courses
      </Link>
      <PageHeader
        eyebrow={COURSE_CATEGORIES.find((k) => k.slug === c.category)?.label ?? c.category}
        title={c.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone[c.status]}>{statusLabel(c.status)}</Badge>
            <span className="text-ink-tertiary">
              {c.enrolCount} enrolled · updated {formatDate(c.updatedAt)}
            </span>
            <SaveIndicator />
          </span>
        }
      />
      {locked ? (
        <div className="mb-6 rounded-card border border-warning bg-warning-tint px-4 py-3 text-small text-ink">
          <strong className="font-semibold">Under review.</strong> Editing is locked until the
          Elevate team responds. You will get an email either way.
        </div>
      ) : null}
      {c.status === 'rejected' && c.rejectionReason ? (
        <div className="mb-6 rounded-card border border-danger bg-danger-tint px-4 py-3 text-small text-ink">
          <strong className="font-semibold">Changes requested:</strong> {c.rejectionReason}
        </div>
      ) : null}
      {c.status === 'live' ? (
        <div className="mb-6 rounded-card border border-success bg-success-tint px-4 py-3 text-small text-ink">
          <strong className="font-semibold">Live.</strong> Edits publish immediately to enrolled
          learners.
        </div>
      ) : null}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger
            value="review"
            className={
              !c.checklist.ok && c.status !== 'pending_review'
                ? 'after:ml-1.5 after:inline-block after:size-1.5 after:rounded-full after:bg-accent'
                : ''
            }
          >
            Review &amp; submit
          </TabsTrigger>
        </TabsList>
        <TabsContent value="curriculum">
          <CurriculumEditor course={c} locked={locked} />
        </TabsContent>
        <TabsContent value="map">
          <PrerequisitesEditor course={c} locked={locked} />
        </TabsContent>
        <TabsContent value="details">
          <DetailsForm key={c.updatedAt} course={c} locked={locked} />
        </TabsContent>
        <TabsContent value="review">
          <ReviewPanel course={c} onGoTo={setTab} />
        </TabsContent>
      </Tabs>
    </SaveTrackerProvider>
  )
}
