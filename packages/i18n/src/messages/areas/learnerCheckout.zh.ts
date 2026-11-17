import type { learnerCheckoutEn } from './learnerCheckout.en'

/** Drafted by Claude; reviewed and signed off by the author. */
export const learnerCheckoutZh = {
  'learnerCheckout.title': '结账',
  'learnerCheckout.back': '返回',
  'learnerCheckout.backToCourse': '返回课程',
  'learnerCheckout.loadError.title': '无法开始结账',

  'learnerCheckout.web.title': '付款需在网页上完成',
  'learnerCheckout.web.body':
    '为了保持低价，我们在 elevate.sg 网站上收取银行卡付款，而不通过应用商店。付款完成后，您的报名会立即显示在这里。',
  'learnerCheckout.web.continue': '在网页上继续',

  'learnerCheckout.byTeacher': '{teacher} 授课',

  'learnerCheckout.promo.label': '优惠码',
  'learnerCheckout.promo.placeholder': '例如 WELCOME10',
  'learnerCheckout.promo.apply': '使用',
  'learnerCheckout.promo.update': '更新',
  'learnerCheckout.promo.appliedPercent': '已使用 {code}：立减 {percent}%',
  'learnerCheckout.promo.appliedAmount': '已使用 {code}：立减 {amount}',

  'learnerCheckout.row.price': '课程价格',
  'learnerCheckout.row.discount': '优惠',
  'learnerCheckout.row.total': '今日应付',
  'learnerCheckout.fees': '已包含所有支付手续费，无需订阅。',
  'learnerCheckout.pay.free': '免费报名',
  'learnerCheckout.pay.stripe': '通过 Stripe 支付 {price}',
  'learnerCheckout.belowMinimum': '优惠后的价格低于最低银行卡付款金额。请移除优惠码后继续。',
  'learnerCheckout.stripeNote': '您将前往 Stripe 的安全结账页面，完成后会返回这里。',

  'learnerCheckout.success.checking': '正在确认您的付款…',
  'learnerCheckout.success.eyebrow': '已报名',
  'learnerCheckout.success.title': '报名成功！',
  'learnerCheckout.success.body':
    '确认邮件即将送达。您的学习进度会随时保存，在任何设备上都能继续学习。',
  'learnerCheckout.success.start': '开始学习',
  'learnerCheckout.success.backToCourse': '返回课程页面',
  'learnerCheckout.expired.title': '此次结账已过期',
  'learnerCheckout.expired.body': '本次未收取任何费用。请从课程页面重新开始。',
  'learnerCheckout.expired.explore': '浏览课程',
  'learnerCheckout.failed.title': '无法确认付款',
  'learnerCheckout.failed.noSession': '此页面缺少结账信息。',
  'learnerCheckout.failed.slow':
    '付款确认所需时间比平时长。Stripe 确认后，您的报名会显示在“我的学习”中。',
  'learnerCheckout.failed.myLearning': '前往“我的学习”',
} satisfies Record<keyof typeof learnerCheckoutEn, string>
