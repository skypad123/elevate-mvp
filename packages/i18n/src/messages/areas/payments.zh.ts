import type { paymentsEn } from './payments.en'

export const paymentsZh = {
  'payments.title': '收款',
  'payments.description.enabled': '学员可以向您付款。款项会按 Stripe 的结算周期转入您的银行账户。',
  'payments.description.nameCheck':
    'Stripe 账户已连接。Elevate 核对该账户的法定名称与公司一致后，学员即可购买课程。',
  'payments.description.connect': '连接 Stripe 账户后，学员即可向您付款。大约需要五分钟。',
  'payments.badge.enabled': '收款已开通',
  'payments.badge.nameCheck': '法定名称待核对',
  'payments.badge.onboarding': '开通未完成',
  'payments.badge.notConnected': '未连接',
  'payments.nameCheck.note':
    'Elevate 会核对 Stripe 账户上的法定名称与公司是否一致。如有出入，所有者会收到邮件，说明需要在 Stripe 中更改的内容。',
  'payments.ownerOnly': '只有教学档案的所有者才能连接 Stripe 或打开其控制台。',
  'payments.finishOnboarding': '完成 Stripe 开通',
  'payments.commission': '您的课程佣金：{rate}',
  'payments.verifying': 'Stripe 正在验证您的资料。',

  'payments.reauth.title': '请重新登录以继续',
  'payments.reauth.description': '管理收款需要您在过去 24 小时内登录过。',

  'payments.return.checking': '正在检查您的 Stripe 账户…',
  'payments.return.connected.title': 'Stripe 已连接',
  'payments.return.connected.description': '学员现在可以付费购买您的课程了。',
  'payments.return.nameCheck.title': 'Stripe 设置完成',
  'payments.return.nameCheck.description':
    'Elevate 接下来会核对该账户的法定名称。课程可供购买时，我们会发邮件通知您。',
  'payments.return.incomplete.title': '就快完成了',
  'payments.return.incomplete.description': 'Stripe 还需要一些资料才能开通收款。',
  'payments.return.failed': '无法检查 Stripe 状态',

  'payments.refresh.redirecting': '正在返回 Stripe…',
} satisfies Record<keyof typeof paymentsEn, string>
