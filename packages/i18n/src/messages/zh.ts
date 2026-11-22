/**
 * 简体中文. Each area in `areas/<area>.zh.ts` is checked against its English file when it is
 * compiled (`satisfies`), so a missing or unknown key is a type error in that file. A key that is
 * missing here would fall back to English at runtime; the catalog test lists such keys.
 *
 * Terms, so that areas agree:
 *
 * - teaching profile 教学档案 · personal profile 个人档案 · company profile 公司档案 · company 公司
 * - owner 所有者 · manager 管理员 · writer 撰稿人 · member 成员 · invitation 邀请
 * - learner 学员 · teacher 教师 · Elevate staff Elevate 员工
 * - course 课程 · lesson 课时 · item (video, audio, text, quiz) 内容 · quiz 测验 · prerequisite 先修课时
 * - live 已上线 · draft 草稿 · changes 更改 · clash 冲突 · approve 批准 · reject 拒绝 · discard 放弃
 * - application 申请 · review 审核 · payout account 收款账户 · earnings 收入 · commission 佣金
 * - legal name 法定名称 · legal-name check 法定名称核对 · sign in 登录 · sign out 退出登录
 * - business profile (the ACRA document a company uploads) 商业档案 · Stripe onboarding 开通
 * - on a Stripe account: charges 收款 · payouts 提现. Elsewhere "payouts" is the teacher's
 *   money matters as a whole, 收款; money on its way to the bank is 款项.
 * - leave a profile 离开 (never 退出, which is half of "sign out")
 * - Elevate, Teach, Support, Stripe and UEN stay as they are.
 * - The learner app: enrol / enrolment 报名 (never 注册) · checkout 结账 · pay 支付 · payment 付款 ·
 *   promo code 优惠码 · receipt 收据 · refund 退款 · original payment method 原付款方式 ·
 *   sign-in code 登录验证码 · create an account 创建账户 · Explore 探索 · My Learning 我的学习 ·
 *   attempt 作答（次） · pass mark 及格线 · score 得分 · locked 未解锁 · certificate 证书 ·
 *   verify 验证 · Certificate of completion 结业证书 · item types 视频 / 音频 / 图文 / 测验.
 *   Counters: 门课程 · 个课时 · 项内容 · 道题 · 次.
 *
 * Style: address the reader as 您; a half-width space between Chinese and Latin letters or
 * digits; full-width punctuation (，。：；？！（）“”) in Chinese sentences.
 */
import type { Messages } from '../types'
import { apiErrorZh } from './areas/apiError.zh'
import { applicationZh } from './areas/application.zh'
import { changesZh } from './areas/changes.zh'
import { chromeZh } from './areas/chrome.zh'
import { commonZh } from './areas/common.zh'
import { companyApplyZh } from './areas/companyApply.zh'
import { domainZh } from './areas/domain.zh'
import { emailZh } from './areas/email.zh'
import { invitationZh } from './areas/invitation.zh'
import { learnerAuthZh } from './areas/learnerAuth.zh'
import { learnerCertificateZh } from './areas/learnerCertificate.zh'
import { learnerCheckoutZh } from './areas/learnerCheckout.zh'
import { learnerCommonZh } from './areas/learnerCommon.zh'
import { learnerCourseZh } from './areas/learnerCourse.zh'
import { learnerExploreZh } from './areas/learnerExplore.zh'
import { learnerLearnZh } from './areas/learnerLearn.zh'
import { learnerTeachZh } from './areas/learnerTeach.zh'
import { membersZh } from './areas/members.zh'
import { paymentsZh } from './areas/payments.zh'
import { personalApplyZh } from './areas/personalApply.zh'
import { portalAuthZh } from './areas/portalAuth.zh'
import { supportCompanyZh } from './areas/supportCompany.zh'
import { supportProfileZh } from './areas/supportProfile.zh'
import { supportProfilesZh } from './areas/supportProfiles.zh'
import { supportRecoveryZh } from './areas/supportRecovery.zh'
import { teachSettingsZh } from './areas/teachSettings.zh'
import { teachShellZh } from './areas/teachShell.zh'
import { uiZh } from './areas/ui.zh'

/** Every area, for the test that no key is defined twice. Keep in step with `zh`. */
export const zhAreas: readonly Readonly<Record<string, string>>[] = [
  chromeZh,
  commonZh,
  domainZh,
  uiZh,
  teachShellZh,
  teachSettingsZh,
  paymentsZh,
  membersZh,
  invitationZh,
  companyApplyZh,
  personalApplyZh,
  portalAuthZh,
  applicationZh,
  changesZh,
  supportProfilesZh,
  supportProfileZh,
  supportCompanyZh,
  supportRecoveryZh,
  apiErrorZh,
  learnerCommonZh,
  learnerExploreZh,
  learnerAuthZh,
  learnerCourseZh,
  learnerCheckoutZh,
  learnerLearnZh,
  learnerTeachZh,
  learnerCertificateZh,
  emailZh,
]

export const zh: Partial<Messages> = {
  ...chromeZh,
  ...commonZh,
  ...domainZh,
  ...uiZh,
  ...teachShellZh,
  ...teachSettingsZh,
  ...paymentsZh,
  ...membersZh,
  ...invitationZh,
  ...companyApplyZh,
  ...personalApplyZh,
  ...portalAuthZh,
  ...applicationZh,
  ...changesZh,
  ...supportProfilesZh,
  ...supportProfileZh,
  ...supportCompanyZh,
  ...supportRecoveryZh,
  ...apiErrorZh,
  ...learnerCommonZh,
  ...learnerExploreZh,
  ...learnerAuthZh,
  ...learnerCourseZh,
  ...learnerCheckoutZh,
  ...learnerLearnZh,
  ...learnerTeachZh,
  ...learnerCertificateZh,
  ...emailZh,
}
