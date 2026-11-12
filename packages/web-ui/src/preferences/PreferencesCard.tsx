import { supportedLocales, type ThemePreference, themePreferenceSchema } from '@elevate/core'
import { localeNames } from '@elevate/i18n'
import type { LucideIcon } from 'lucide-react'
import { Languages, Monitor, Moon, Sun } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'
import { Button } from '../components/Button'
import { Card, CardHeader } from '../components/Card'
import { Dialog } from '../components/Dialog'
import { NativeSelect } from '../components/Input'
import { SegmentedControl } from '../components/SegmentedControl'
import { cn } from '../lib/cn'
import { usePreferences, useT } from './PreferencesProvider'

/** One labelled preference: text on the left, control on the right (stacked when narrow). */
export function PreferenceRow({
  label,
  description,
  control,
  className,
}: {
  label: string
  description?: string
  /** Receives the id to use for `aria-labelledby` so the control is announced with its label. */
  control: (labelId: string) => ReactNode
  className?: string
}) {
  const labelId = useId()
  return (
    // Stacks in a narrow card (e.g. a sidebar column) and goes side by side when the card is wide.
    <div
      className={cn(
        'flex flex-col gap-3 border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0 @md:flex-row @md:items-center @md:justify-between @md:gap-6',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p id={labelId} className="text-small-strong font-semibold text-ink">
          {label}
        </p>
        {description ? <p className="mt-0.5 text-small text-ink-secondary">{description}</p> : null}
      </div>
      <div className="shrink-0">{control(labelId)}</div>
    </div>
  )
}

const themeIcons: Record<ThemePreference, LucideIcon> = { system: Monitor, light: Sun, dark: Moon }

/**
 * The preference rows on their own. Add a `PreferenceRow` here when a new field joins
 * `preferencesSchema`; the options below are derived from the schema so a new enum member only
 * needs an i18n key. The rows lay themselves out by container width, so render them inside an
 * `@container` element.
 */
export function PreferenceRows() {
  const { preferences, setPreference, t } = usePreferences()
  return (
    <>
      <PreferenceRow
        label={t('prefs.appearance')}
        description={t('prefs.appearance.description')}
        control={(labelId) => (
          <SegmentedControl
            aria-labelledby={labelId}
            value={preferences.theme}
            onValueChange={(theme) => setPreference('theme', theme)}
            options={themePreferenceSchema.options.map((value) => ({
              value,
              label: t(`prefs.theme.${value}`),
              icon: themeIcons[value],
            }))}
          />
        )}
      />
      <PreferenceRow
        label={t('prefs.language')}
        description={t('prefs.language.description')}
        control={(labelId) => (
          <NativeSelect
            aria-labelledby={labelId}
            wrapperClassName="sm:w-48"
            value={preferences.locale}
            onChange={(e) =>
              setPreference('locale', e.target.value as (typeof supportedLocales)[number])
            }
          >
            {supportedLocales.map((locale) => (
              <option key={locale} value={locale} lang={locale}>
                {localeNames[locale]}
              </option>
            ))}
          </NativeSelect>
        )}
      />
    </>
  )
}

/** The Preferences section shown in every portal's Settings. */
export function PreferencesCard({ className }: { className?: string }) {
  const t = useT()
  return (
    <Card as="section" className={cn('@container', className)}>
      <CardHeader title={t('prefs.title')} description={t('prefs.description')} />
      <PreferenceRows />
    </Card>
  )
}

/** The same rows in a dialog, for a page that has no Settings page to hold the card. */
export function PreferencesDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('prefs.title')}
      description={t('prefs.description')}
    >
      <div className="@container">
        <PreferenceRows />
      </div>
    </Dialog>
  )
}

/**
 * A header button that opens the preferences dialog. It is for pages shown before someone can
 * reach Settings (Teach's application and set-up pages, an invitation link), so they can still
 * pick a language and a theme. The icon is the usual sign for "language", for a reader who cannot
 * read the label.
 */
export function PreferencesButton({ className }: { className?: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('prefs.title')}
        title={t('prefs.title')}
        className={className}
        onClick={() => setOpen(true)}
      >
        <Languages className="size-4" />
      </Button>
      <PreferencesDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
