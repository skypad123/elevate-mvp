import type { supportCompanyEn } from './supportCompany.en'

// A match is 一致 and a mismatch 不一致. "Charges" (Stripe letting the account take payments) is
// 收款功能, the 收款 row of the payout account on the same page; a company "being paid" is 收款.
// A {date} reads like 2026年11月12日: a space before it after a Chinese character, none after it.
export const supportCompanyZh = {
  'companyCard.title': '公司',
  'companyCard.check.pending.label': '尚未核对',
  'companyCard.check.pending.description':
    '批准前，请对照商业档案核对这些信息。一经批准，该公司即记录为已核实。',
  'companyCard.check.verified.label': '已核实',
  'companyCard.check.verified.description': '批准申请时已对照商业档案核对。',
  'companyCard.check.rejected.label': '已拒绝',
  'companyCard.check.rejected.description': '申请已被拒绝。所有者可以更正后重新提交。',
  'companyCard.checked': '核对日期',
  'companyCard.checked.by': '{date}，由 {name} 核对',
  'companyCard.rejectionReason': '拒绝原因',
  'companyCard.registryDocument': '商业档案',
  'companyCard.registryDocument.none': '无存档。只有预置的演示公司才没有商业档案。',

  'nameCheck.title': '法定名称核对',
  'nameCheck.description': '仅当 Stripe 账户上的法定名称与此处批准的公司一致时，公司才能收款。',
  'nameCheck.state.match': '名称一致',
  'nameCheck.state.mismatch': '名称不一致',
  'nameCheck.state.waiting': '待核对',
  'nameCheck.state.notStarted': '未开始',
  'nameCheck.notStarted': '该公司尚未开始办理 Stripe 开通，因此暂无可供核对的 Stripe 名称。',

  'nameCheck.stripeName': 'Stripe 账户上的名称',
  'nameCheck.stripeName.notReturned': 'Stripe 未返回法定名称',
  'nameCheck.stripeName.none': '尚无法定名称',
  'nameCheck.openInStripe': '在 Stripe 中打开',
  'nameCheck.companyName': '此处批准的公司',

  'nameCheck.dashboardName': 'Stripe 控制台中显示的法定名称',
  'nameCheck.dashboardName.hint':
    'Stripe 的 API 未返回此账户的法定名称。请在 Stripe 中打开该账户，并照原样输入其中显示的法定名称。该名称会随审计记录一并保存。',

  'nameCheck.mismatch.recorded': '已于 {date}记录为不一致',
  'nameCheck.mismatch.recordedBy': '已于 {date}由 {name} 记录为不一致',
  'nameCheck.mismatch.stripeShowed': '当时 Stripe 显示的名称为“{name}”。已向所有者发送以下说明：',
  'nameCheck.mismatch.stripeShowedNothing': '当时 Stripe 未显示法定名称。已向所有者发送以下说明：',

  'nameCheck.record.match': '已于 {date}记录为一致。',
  'nameCheck.record.matchBy': '已于 {date}由 {name} 记录为一致。',
  'nameCheck.record.checkAgain': '所有者告知 Stripe 账户已更正后，请再次核对。',
  'nameCheck.record.none': '尚无核对记录。',
  'nameCheck.account.active': '账户已启用，因此该公司的课程可供购买。',
  'nameCheck.account.chargesOff':
    'Stripe 尚未为此账户启用收款功能。现在记录的一致结果，将在 Stripe 启用后生效。',
  'nameCheck.account.chargesOn': 'Stripe 已启用收款功能。记录名称一致后，账户即启用。',
  'nameCheck.sentences': '{first}{second}',

  'nameCheck.action.match': '名称一致',
  'nameCheck.action.mismatch': '名称不一致',
  'nameCheck.action.noLongerMatch': '名称已不再一致',

  'nameCheck.matchDialog.title': '要记录名称一致吗？',
  'nameCheck.matchDialog.description':
    'Stripe 启用收款功能后，学员即可向这家公司付款。此次核对将记录在您的名下。',
  'nameCheck.matchDialog.company': '公司',
  'nameCheck.matchDialog.confirm': '记录为一致',

  'nameCheck.mismatchDialog.title': '记录名称不一致',
  'nameCheck.mismatchDialog.description':
    '在记录名称一致之前，该公司无法收款。您的说明会通过邮件发送给所有者，因此请写明需要在 Stripe 中更改的内容。',
  'nameCheck.mismatchDialog.note': '不一致之处（将发送给所有者）',
  'nameCheck.mismatchDialog.confirm': '记录为不一致',

  'nameCheck.toast.match': '已记录名称一致',
  'nameCheck.toast.match.active': '该公司现在可以收款了。',
  'nameCheck.toast.match.waiting': 'Stripe 启用收款功能后，该公司即可开始收款。',
  'nameCheck.toast.mismatch': '已记录名称不一致',
  'nameCheck.toast.mismatch.emailed': '已将您的说明通过邮件发送给所有者。',
  'nameCheck.toast.failed': '无法记录核对结果',
} satisfies Record<keyof typeof supportCompanyEn, string>
