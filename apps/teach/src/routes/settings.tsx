import {
  Button,
  Card,
  CardHeader,
  DescriptionList,
  formatBps,
  formatDate,
  Input,
  PageHeader,
  Textarea,
  useToast,
} from '@elevate/web-ui'
import { errorMessage, fieldErrors, unwrap, usePortalAuth } from '@elevate/web-ui/portal'
import { useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { teachKeys, useTeacherProfile } from '../lib/queries'
import { StripeCard } from './dashboard'

export function SettingsPage() {
  const { user, refreshUser } = usePortalAuth()
  const { data: profile } = useTeacherProfile()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [form, setForm] = useState({ displayName: '', headline: '', bio: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (profile)
      setForm({
        displayName: profile.displayName,
        headline: profile.headline ?? '',
        bio: profile.bio ?? '',
      })
  }, [profile])

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      await unwrap(await api.teach.profile.$patch({ json: form }))
      await queryClient.invalidateQueries({ queryKey: teachKeys.profile })
      await refreshUser()
      toast({ tone: 'success', title: 'Profile saved' })
    } catch (error) {
      setErrors(fieldErrors(error))
      toast({ tone: 'danger', title: 'Could not save', description: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Your teacher profile"
        description="What learners see on your course pages."
      />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <form onSubmit={save}>
          <Card as="section" className="space-y-5">
            <Input
              label="Display name"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              error={errors.displayName}
              required
            />
            <Input
              label="Headline"
              value={form.headline}
              onChange={(e) => setForm({ ...form, headline: e.target.value })}
              error={errors.headline}
              required
            />
            <Textarea
              label="Bio"
              rows={7}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              error={errors.bio}
              required
            />
            <div className="flex justify-end">
              <Button type="submit" loading={busy}>
                Save changes
              </Button>
            </div>
          </Card>
        </form>
        <div className="space-y-6">
          <StripeCard />
          <Card as="section">
            <CardHeader title="Account" />
            <DescriptionList
              items={[
                { label: 'Email', value: user?.email },
                { label: 'Commission', value: profile ? formatBps(profile.commissionBps) : '—' },
                { label: 'Approved', value: formatDate(profile?.reviewedAt) },
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  )
}
