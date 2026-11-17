import type { emailEn } from './email.en'

export const emailZh = {
  'email.footer.ignore': '如果您没有请求过这封邮件，忽略即可。',
  'email.text.cta': '{label}：{url}',

  'email.signIn.subject': '您的 {portal} 登录验证码：{code}',
  'email.signIn.title': '登录 {portal}',
  'email.signIn.body': '请点击下方按钮登录。此链接只能使用一次，{minutes} 分钟后失效。',
  'email.signIn.button': '登录',
  'email.signIn.codeIntro': '正在使用手机？您也可以在应用中输入以下验证码：',
  'email.signIn.text.open': '打开此链接（{minutes} 分钟内有效，仅可使用一次）：',
  'email.signIn.text.code': '或在应用中输入验证码：{code}',

  'email.receipt.title': '您已报名：{course}',
  'email.receipt.paid': '感谢您的购买。您已为 {teacher} 的“{course}”支付 {amount}。',
  'email.receipt.stripeReceipt': '您的 Stripe 收据：{url}',
  'email.receipt.noReceipt': '您可以在 Stripe 的付款确认中查看收据。',
  'email.receipt.start': '您可以随时开始学习，学习进度会自动保存。',
  'email.receipt.button': '开始学习',

  'email.certificate.title': '您的证书：{course}',
  'email.certificate.congrats': '恭喜您，{name}！您已完成 {teacher} 的“{course}”。',
  'email.certificate.verify': '任何人都可以在 {url} 验证此证书，无需登录。',
  'email.certificate.button': '查看证书',

  'email.refund.title': '已为“{course}”办理退款',
  'email.refund.refunded': '我们已将 {amount} 退回您的原付款方式。款项可能需要 5–10 个工作日到账。',
  'email.refund.reason': '原因：{reason}',
  'email.refund.reasonStripe': '已在 Stripe 中退款',
  'email.refund.accessRemoved': '您对这门课程的访问权限已被移除。',

  'email.duplicate.title': '您为“{course}”重复付款，已办理退款',
  'email.duplicate.refunded':
    '您为“{course}”支付了两次，因此我们已将第二笔付款 {amount} 退回您的原付款方式。款项可能需要 5–10 个工作日到账。',
  'email.duplicate.kept': '您的报名和学习进度不受影响。',
  'email.duplicate.removed':
    '您为这门课程的另一笔付款也已退款，因此您对这门课程的访问权限已被移除。',
  'email.duplicate.button': '前往课程',
} satisfies Record<keyof typeof emailEn, string>
