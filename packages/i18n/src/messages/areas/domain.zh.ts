import type { domainEn } from './domain.en'

export const domainZh = {
  'profileRole.owner': '所有者',
  'profileRole.manager': '管理员',
  'profileRole.writer': '撰稿人',
  'profileRole.owner.summary': '拥有全部权限，包括收款设置和管理员的任免。',
  'profileRole.manager.summary':
    '与所有者一起运营档案，包括课程、价格、发布、撰稿人和收入。收款设置和管理员的任免仍由所有者负责。',
  'profileRole.writer.summary':
    '创建和编辑课程内容。不能修改价格、发布课程或查看收入。对已上线课程的修改需等待批准。',
  'profileRole.note': '{role}：{summary}',

  'profileType.personal': '个人',
  'profileType.corporate': '公司',

  'status.profile.applied': '已申请',
  'status.profile.approved': '已批准',
  'status.profile.rejected': '已拒绝',
  'status.course.draft': '草稿',
  'status.course.pending_review': '待审核',
  'status.course.live': '已上线',
  'status.course.rejected': '已拒绝',
  'status.payout.onboarding': '开通中',
  'status.payout.active': '已启用',

  'entityType.private_limited': '私人有限公司（Pte. Ltd.）',
  'entityType.llp': '有限责任合伙企业（LLP）',
  'company.legalName': '法定名称',
  'company.legalForm': '企业类型',
  'company.uen': 'UEN',
  'company.uenValue': 'UEN {uen}',

  'profileField.displayName': '显示名称',
  'profileField.headline': '一句话简介',
  'profileField.bio': '简介',

  'stripe.account': 'Stripe 账户',
  'stripe.connect': '连接 Stripe',
  'stripe.openDashboard': '打开 Stripe 控制台',
} satisfies Record<keyof typeof domainEn, string>
