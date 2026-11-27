import type { portalAuthEn } from './portalAuth.en'

/** Drafted by Claude; signed off by the author on 2026-11-27. */
export const portalAuthZh = {
  'portalAuth.signIn.eyebrow': '登录',
  'portalAuth.signIn.emailLabel': '邮箱',
  'portalAuth.signIn.emailPlaceholder': 'you@example.com',
  'portalAuth.signIn.request': '发送登录验证码',
  'portalAuth.signIn.invalidEmail': '请输入有效的邮箱地址',
  'portalAuth.signIn.noPasswords': '使用一次性链接和验证码登录，无需密码。{back}',

  'portalAuth.code.eyebrow': '请查收邮件',
  'portalAuth.code.title': '输入 6 位验证码',
  'portalAuth.code.sentTo':
    '登录链接和验证码已发送至 {email}。请点击邮件中的链接，或在此输入验证码。',
  'portalAuth.code.label': '验证码',
  'portalAuth.code.placeholder': '123 456',
  'portalAuth.code.verify': '验证',
  'portalAuth.code.differentEmail': '使用其他邮箱',
  'portalAuth.code.resend': '重新发送',

  'portalAuth.verify.signingIn': '正在为您登录…',
  'portalAuth.verify.eyebrow': '登录链接',
  'portalAuth.verify.title': '无法登录',
  'portalAuth.verify.incomplete': '此登录链接不完整，请重新获取。',
  'portalAuth.verify.requestNew': '重新获取链接',
  'portalAuth.verify.back': '返回首页',

  'portalAuth.blurb.teach': '编写课程、提交审核，并通过 Stripe 收款。',
  'portalAuth.blurb.support': '内部工具：审核课程、批准教师、管理付款。',
} satisfies Record<keyof typeof portalAuthEn, string>
