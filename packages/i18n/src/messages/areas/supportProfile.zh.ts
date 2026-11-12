import type { supportProfileEn } from './supportProfile.en'

// In a payout account's rows "Charges" is 收款 and "Payouts" is 提现: no two labels of that list
// may read the same, because the list uses them as keys. A {date} reads like 2026年11月12日: a
// space before it after a Chinese character, none after it.
export const supportProfileZh = {
  'profileDetail.loadError': '无法加载此档案',

  'profileDetail.back': '教学档案',
  'profileDetail.eyebrow.personal': '个人档案',
  'profileDetail.eyebrow.corporate': '公司档案',
  'profileDetail.ownedBy': '所有者：{email}',
  'profileDetail.openInTeach': '在 Teach 中打开',
  'profileDetail.reject': '拒绝',
  'profileDetail.approve': '批准',

  'profileDetail.stat.courses': '课程',
  'profileDetail.stat.courses.live': '{count} 门已上线',
  'profileDetail.stat.sales': '销量',
  'profileDetail.stat.sales.hint': '付费报名数',
  'profileDetail.stat.netEarnings': '净收入',
  'profileDetail.stat.netEarnings.hint': '已扣除 Stripe 手续费、佣金和退款',
  'profileDetail.stat.applied': '申请日期',

  'profileDetail.application.title': '申请',
  'profileDetail.application.applied': '申请于 {applied}',
  'profileDetail.application.appliedReviewed': '申请于 {applied} · 审核于 {reviewed}',
  'profileDetail.application.credentials': '资质',
  'profileDetail.application.reviewNote': '审核意见',

  'profileDetail.sample.title': '教学示例',
  'profileDetail.sample.none': '未提供示例。',

  'profileDetail.courses.title': '课程',
  'profileDetail.courses.description': '打开课程，以审核者的身份查看其内容。',
  'profileDetail.courses.empty': '此档案还没有课程。',
  'profileDetail.courses.column.course': '课程',
  'profileDetail.courses.column.price': '价格',
  'profileDetail.courses.column.enrolled': '报名人数',

  'profileDetail.owner.title': '所有者',
  'profileDetail.owner.description': '唯一持有此档案的人。',
  'profileDetail.owner.open': '查看此用户',
  'profileDetail.owner.recoveryNote': '所有者无法再登录时，只有超级管理员可以办理所有者恢复。',

  'profileDetail.payout.title': '收款账户',
  'profileDetail.payout.description': '此档案用来收款的 Stripe 账户。',
  'profileDetail.payout.none.personal':
    '暂无。所有者尚未开始 Stripe 开通流程，因此该档案的课程还无法购买。',
  'profileDetail.payout.none.corporate':
    '暂无。所有者尚未为公司开始 Stripe 开通流程，因此该档案的课程还无法购买。',
  'profileDetail.payout.kind': '账户类型',
  'profileDetail.payout.kind.company': '公司',
  'profileDetail.payout.kind.individual': '个人',
  'profileDetail.payout.charges': '收款',
  'profileDetail.payout.payouts': '提现',
  'profileDetail.payout.enabled': '已启用',
  'profileDetail.payout.notEnabled': '未启用',
  'profileDetail.payout.legalName.matched': '已于 {date}核对一致',
  'profileDetail.payout.legalName.notChecked': '尚未核对',
  'profileDetail.payout.activeSince': '启用日期',
  'profileDetail.payout.firstActive': '首次启用日期',

  'profileDetail.commission.title': '佣金',
  'profileDetail.commission.description': '扣除 Stripe 手续费后，平台从每笔销售中收取的比例。',
  'profileDetail.commission.current': '当前比例',
  'profileDetail.commission.newRate': '新比例（%）',
  'profileDetail.commission.superAdminOnly': '只有超级管理员可以修改佣金。',
  'profileDetail.commission.updated': '佣金已更新',

  'profileDetail.approve.title': '批准此档案？',
  'profileDetail.approve.description.personal':
    '所有者可以立即连接 Stripe 并创建课程，同时会收到一封邮件。',
  'profileDetail.approve.description.corporate':
    '批准后，系统会记录您已对照商业档案核对过 {legalName}（UEN {uen}）。所有者随后可以连接公司的 Stripe 账户，并会收到一封邮件。',
  'profileDetail.approve.note': '内部备注（选填）',
  'profileDetail.approve.done': '档案已批准',

  'profileDetail.reject.title': '拒绝此申请',
  'profileDetail.reject.description': '原因会通过邮件发送给所有者。对方可以修改申请后重新提交。',
  'profileDetail.reject.reason': '原因（将发送给所有者）',
  'profileDetail.reject.done': '申请已拒绝',
} satisfies Record<keyof typeof supportProfileEn, string>
