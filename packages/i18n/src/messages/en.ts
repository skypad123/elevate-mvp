/**
 * English is the source of truth: its keys define `MessageKey`, so a typo in `t('…')` is a type
 * error, and every other catalog is checked against these keys.
 *
 * The catalog is written one area at a time in `areas/<area>.en.ts` (and `<area>.zh.ts`) and put
 * together here. Keys are flat, dot-separated and start with their area. `{name}` placeholders
 * are interpolated by `translate`.
 *
 * Translated today: navigation, the Settings/Preferences/Profile screens, and the teaching-profile
 * screens of Teach and Support (members, invitations, held changes, company application and
 * set-up, Support's profile pages). Other pages are still English.
 *
 * To add an area: write the two files, then add it to `enAreas` and to `en` below, and to the
 * same two places in `zh.ts`. `test/catalog.test.ts` fails if the two lists disagree or if two
 * areas define the same key.
 */
import { applicationEn } from './areas/application.en'
import { changesEn } from './areas/changes.en'
import { chromeEn } from './areas/chrome.en'
import { commonEn } from './areas/common.en'
import { companyApplyEn } from './areas/companyApply.en'
import { domainEn } from './areas/domain.en'
import { invitationEn } from './areas/invitation.en'
import { membersEn } from './areas/members.en'
import { paymentsEn } from './areas/payments.en'
import { supportCompanyEn } from './areas/supportCompany.en'
import { supportProfileEn } from './areas/supportProfile.en'
import { supportProfilesEn } from './areas/supportProfiles.en'
import { supportRecoveryEn } from './areas/supportRecovery.en'
import { teachSettingsEn } from './areas/teachSettings.en'
import { teachShellEn } from './areas/teachShell.en'
import { uiEn } from './areas/ui.en'

/** Every area, for the test that no key is defined twice. Keep in step with `en`. */
export const enAreas: readonly Readonly<Record<string, string>>[] = [
  chromeEn,
  commonEn,
  domainEn,
  uiEn,
  teachShellEn,
  teachSettingsEn,
  paymentsEn,
  membersEn,
  invitationEn,
  companyApplyEn,
  applicationEn,
  changesEn,
  supportProfilesEn,
  supportProfileEn,
  supportCompanyEn,
  supportRecoveryEn,
]

export const en = {
  ...chromeEn,
  ...commonEn,
  ...domainEn,
  ...uiEn,
  ...teachShellEn,
  ...teachSettingsEn,
  ...paymentsEn,
  ...membersEn,
  ...invitationEn,
  ...companyApplyEn,
  ...applicationEn,
  ...changesEn,
  ...supportProfilesEn,
  ...supportProfileEn,
  ...supportCompanyEn,
  ...supportRecoveryEn,
} as const
