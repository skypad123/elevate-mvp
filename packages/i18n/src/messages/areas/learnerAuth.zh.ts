import type { learnerAuthEn } from './learnerAuth.en'

/** Drafted by Claude; reviewed and signed off by the author. */
export const learnerAuthZh = {
  'learnerAuth.email.eyebrow': '登录或创建账户',
  'learnerAuth.email.title': '接着上次的进度继续学习。',
  'learnerAuth.email.body': '我们会通过邮件向您发送一次性登录链接和 6 位验证码。无需密码。',
  'learnerAuth.email.label': '邮箱',
  'learnerAuth.email.placeholder': 'you@example.com',
  'learnerAuth.email.invalid': '请输入有效的邮箱地址',
  'learnerAuth.email.request': '发送登录验证码',
  'learnerAuth.email.terms': '继续即表示您同意 Elevate 的使用条款。教师请前往 Elevate Teach 登录。',

  'learnerAuth.code.eyebrow': '请查收邮件',
  'learnerAuth.code.title': '输入 6 位验证码',
  'learnerAuth.code.sentTo': '验证码已发送至 {email}。',
  'learnerAuth.code.sentToWeb': '验证码已发送至 {email}。您也可以直接点击邮件中的链接。',
  'learnerAuth.code.verify': '验证',
  'learnerAuth.code.changeEmail': '使用其他邮箱',
  'learnerAuth.code.resend': '重新发送验证码',

  'learnerAuth.browse': '免登录浏览课程',

  'learnerAuth.verify.signingIn': '正在为您登录…',
  'learnerAuth.verify.eyebrow': '登录链接',
  'learnerAuth.verify.failed': '无法登录',
  'learnerAuth.verify.incomplete': '此登录链接不完整，请重新获取。',
  'learnerAuth.verify.requestNew': '重新获取链接',
} satisfies Record<keyof typeof learnerAuthEn, string>
