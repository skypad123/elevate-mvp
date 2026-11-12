import {
  COURSE_CATEGORIES,
  type CourseView,
  formatSgd,
  parseSgdToCents,
  quote,
  type RichTextDoc,
} from '@elevate/core'
import {
  Button,
  Card,
  CardHeader,
  DescriptionList,
  Input,
  MediaUploader,
  NativeSelect,
  RichTextEditor,
  Textarea,
} from '@elevate/web-ui'
import { type FormEvent, useState } from 'react'
import { api } from '../lib/api'
import { uploadInlineImage, useCourseActions } from '../lib/courses'
import { useCurrentProfile } from '../lib/profile'
import { useSaveTracker } from '../lib/save-tracker'

export function DetailsForm({ course, locked }: { course: CourseView; locked: boolean }) {
  const actions = useCourseActions(course.id)
  const { track } = useSaveTracker()
  const { profileId, profile, can } = useCurrentProfile()
  // Price has its own permission: staff can fix a course's details but not what it costs.
  const canSetPrice = can('course.setPrice')
  const [title, setTitle] = useState(course.title)
  const [summary, setSummary] = useState(course.summary ?? '')
  const [category, setCategory] = useState(course.category)
  const [price, setPrice] = useState((course.priceCents / 100).toFixed(2))
  const [description, setDescription] = useState<RichTextDoc | null>(course.descriptionJson)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)

  const priceCents = parseSgdToCents(price)
  const preview =
    priceCents !== null && priceCents > 0
      ? quote({
          listPriceCents: priceCents,
          commissionBps: profile?.commissionBps ?? 1500,
          stripeFeeBps: 340,
          stripeFixedCents: 50,
        })
      : null

  async function save(e: FormEvent) {
    e.preventDefault()
    if (priceCents === null) return
    setBusy(true)
    try {
      await track(
        actions.saveDetails(
          {
            title: title.trim(),
            summary: summary.trim() || null,
            category: category as (typeof COURSE_CATEGORIES)[number]['slug'],
            descriptionJson: description,
          },
          // The price goes to its own route, and only when it changed.
          canSetPrice && priceCents !== course.priceCents ? priceCents : null,
        ),
      )
      setDirty(false)
    } finally {
      setBusy(false)
    }
  }

  const mark = () => setDirty(true)

  return (
    <form onSubmit={save} className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        <Card as="section" className="space-y-5">
          <CardHeader
            title="Course page"
            description="This is what learners see in Explore and on the course page."
          />
          <Input
            label="Title"
            value={title}
            disabled={locked}
            required
            minLength={3}
            onChange={(e) => {
              setTitle(e.target.value)
              mark()
            }}
          />
          <Textarea
            label="Summary"
            hint={`${summary.length}/400 · one or two sentences shown on the course card`}
            rows={3}
            maxLength={400}
            value={summary}
            disabled={locked}
            onChange={(e) => {
              setSummary(e.target.value)
              mark()
            }}
          />
          <NativeSelect
            label="Category"
            value={category}
            disabled={locked}
            onChange={(e) => {
              setCategory(e.target.value)
              mark()
            }}
          >
            {COURSE_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </NativeSelect>
          <div>
            <p className="mb-1.5 text-small-strong font-semibold text-ink-secondary">Description</p>
            <RichTextEditor
              value={description}
              disabled={locked}
              placeholder="Who is this for, what will they make or learn, what do they need?"
              onChange={(doc) => {
                setDescription(doc)
                mark()
              }}
              onPickImage={() => uploadInlineImage(profileId)}
              minHeight={260}
            />
          </div>
        </Card>
      </div>
      <div className="space-y-6">
        <Card as="section" className="space-y-4">
          <CardHeader title="Cover image" description="4:3 works best. JPG, PNG or WebP." />
          <MediaUploader
            api={api}
            profileId={profileId}
            kind="image"
            value={course.thumbnail}
            disabled={locked}
            onChange={(asset) =>
              void track(actions.updateCourse({ thumbnailMediaId: asset?.id ?? null }))
            }
          />
        </Card>
        <Card as="section" className="space-y-4">
          <CardHeader title="Price" description="In Singapore dollars. Free courses are allowed." />
          <Input
            label="Price (S$)"
            inputMode="decimal"
            value={price}
            disabled={locked || !canSetPrice}
            hint={canSetPrice ? undefined : 'Only the profile’s owner can change the price.'}
            error={priceCents === null ? 'Enter a valid amount' : undefined}
            onChange={(e) => {
              setPrice(e.target.value)
              mark()
            }}
          />
          {preview ? (
            <DescriptionList
              items={[
                { label: 'Learner pays', value: formatSgd(preview.amountCents) },
                {
                  label: 'Stripe fee (est.)',
                  value: `−${formatSgd(preview.stripeFeeEstimateCents)}`,
                },
                { label: 'Elevate commission', value: `−${formatSgd(preview.commissionCents)}` },
                {
                  label: 'You receive',
                  value: (
                    <strong className="font-semibold text-ink">
                      {formatSgd(preview.teacherNetCents)}
                    </strong>
                  ),
                },
              ]}
            />
          ) : (
            <p className="text-small text-ink-tertiary">
              Free course: learners enrol without paying.
            </p>
          )}
        </Card>
        <div className="flex items-center justify-end gap-3">
          {dirty ? <span className="text-small text-warning">Unsaved changes</span> : null}
          <Button type="submit" loading={busy} disabled={locked || !dirty || priceCents === null}>
            Save details
          </Button>
        </div>
      </div>
    </form>
  )
}
