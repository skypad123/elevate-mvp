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

  // Classes and the refund terms: drafted by Claude; signed off by the author on 2026-11-27.
  // The refund terms still need a lawyer's reading (docs/terms/class-refund-terms.md).
  'learnerCheckout.class.title': '报名班级名额',
  'learnerCheckout.class.course': '“{course}”课程的班级',
  'learnerCheckout.class.instructor': '讲师：{name}',
  'learnerCheckout.class.sessions': '课节',
  'learnerCheckout.class.venue': '上课地点：{address}',
  'learnerCheckout.class.remote': '线上班级',
  'learnerCheckout.class.seatsLeft.one': '剩余 {count} 个名额',
  'learnerCheckout.class.seatsLeft.other': '剩余 {count} 个名额',
  'learnerCheckout.class.full': '这个班级已满，无法报名。',
  'learnerCheckout.class.row.price': '名额价格',
  'learnerCheckout.class.agree': '付款即表示您接受上述退款条款。',
  'learnerCheckout.class.seatHeld':
    '从您按下“付款”起，我们会为您保留名额 35 分钟，供您在 Stripe 上完成付款。',
  'learnerCheckout.class.termsReloaded': '退款条款已更新。请重新阅读下方条款，然后再按“付款”。',
  'learnerCheckout.class.viewSeat': '查看您的班级',
  'learnerCheckout.class.web.body':
    '为了保持低价，我们在 elevate.sg 网站上收款，而不通过应用商店。付款完成后，您的名额会立即显示在“我的学习”中。',

  'learnerCheckout.terms.title': '退款条款',
  'learnerCheckout.terms.version': '版本 {version}',
  'learnerCheckout.terms.forThisClass': '本班级的退出退款期限为 {date}。',
  'learnerCheckout.terms.buying.title': '您购买的内容',
  'learnerCheckout.terms.buying.1':
    '您向 Elevate 购买本页面所列班级在所示日期的一个名额。该班级由本页面所列的教师授课。',
  'learnerCheckout.terms.changeMind.title': '如果您改变主意',
  'learnerCheckout.terms.changeMind.2':
    '只要您尚未出席任何课节，您可以在班级第一节课开始前 7 天之前退出班级。',
  'learnerCheckout.terms.changeMind.3':
    '如果您在期限内退出，我们会退还您支付的价格，扣除我们的支付服务商 Stripe 就您的付款收取的支付手续费。付款被退还时，Stripe 不退还该手续费。手续费取决于您的付款方式，费率见下方“支付手续费”。',
  'learnerCheckout.terms.changeMind.4': '该日期之后，您不能再退出并获得退款。',
  'learnerCheckout.terms.changes.title': '如果班级有变动',
  'learnerCheckout.terms.changes.5':
    '如果教师在您付款后更改了某节课的日期或时间，我们会通过电子邮件通知您。只要您尚未出席任何课节，您可以在班级开始前随时退出，我们会全额退还您支付的价格。',
  'learnerCheckout.terms.cancelled.title': '如果班级被取消',
  'learnerCheckout.terms.cancelled.6':
    '如果教师取消班级，而您尚未出席任何课节，我们会全额退还您支付的价格。',
  'learnerCheckout.terms.cancelled.7':
    '如果教师在您出席过课节后取消班级，我们会退还取消时尚未开始的课节所对应的那部分价格。例如，五节课中已上过一节，我们会退还价格的五分之四。',
  'learnerCheckout.terms.cancelled.8':
    '如果 Elevate 取消班级，无论您是否出席过，我们都会全额退还您支付的价格。',
  'learnerCheckout.terms.attended.title': '“出席”的含义',
  'learnerCheckout.terms.attended.9': '您自己签到了某节课，即为出席了该节课。',
  'learnerCheckout.terms.attended.10':
    '如果讲师为您手动标记了出席，我们已发电子邮件通知您，而您在该邮件发出后 7 天内没有提出申诉，也视为您出席了该节课。如果您及时提出申诉，该标记不计为出席。在这 7 天内，除非您先提出申诉，否则不能退出。',
  'learnerCheckout.terms.seatTaken.title': '如果您付款时名额被占',
  'learnerCheckout.terms.seatTaken.11':
    '您付款期间，我们会为您保留名额 35 分钟。如果您的付款在此之后才到账，而班级已满或已开始，您将无法获得名额，我们会全额退还您支付的价格。',
  'learnerCheckout.terms.paid.title': '退款如何支付',
  'learnerCheckout.terms.paid.12':
    '退款到期后，我们会在一个工作日内发出退款。退款会退回您的原付款方式，发出后我们会通过电子邮件通知您。退回银行卡的款项通常在 5 到 10 个工作日后显示在您的账单上，具体取决于您的银行。通过 PayNow 退回的款项通常几分钟内到账。',
  'learnerCheckout.terms.fee.title': '支付手续费',
  'learnerCheckout.terms.fee.13':
    '第 3 条所述的手续费，是 Stripe 就您本人的付款收取的手续费。Stripe 公布的新加坡元付款费率如下：',
  'learnerCheckout.terms.fee.cardSg': '新加坡发行的银行卡：手续费为价格的 3.4% 加 S$0.50。',
  'learnerCheckout.terms.fee.cardAbroad': '新加坡境外发行的银行卡：手续费为价格的 3.9% 加 S$0.50。',
  'learnerCheckout.terms.fee.paynow': 'PayNow：手续费为价格的 1.3%。',
  'learnerCheckout.terms.fee.gst': '如 Stripe 收取消费税（GST），则另加消费税。',
  'learnerCheckout.terms.fee.example':
    '以 S$500 的名额为例，新加坡发行的银行卡手续费为 S$17.50，PayNow 约为 S$7。您的班级页面会显示您这笔付款的金额。',

  'learnerCheckout.classSuccess.eyebrow': '名额已预订',
  'learnerCheckout.classSuccess.title': '您的名额已预订',
  'learnerCheckout.classSuccess.body':
    '您已获得“{course}”课程班级“{name}”的一个名额。包含上课日期和退款条款的收据将通过电子邮件发送给您。',
  'learnerCheckout.classSuccess.when': '课节',
  'learnerCheckout.classSuccess.venue': '上课地点：{address}',
  'learnerCheckout.classSuccess.remote': '线上班级：讲师会通过电子邮件告诉您如何加入。',
  'learnerCheckout.classSuccess.view': '查看您的班级',
  'learnerCheckout.seatLost.title': '您付款期间名额已被占用',
  'learnerCheckout.seatLost.body':
    '您的付款到账时名额已不再可用，因此您没有获得这个班级的名额。我们会全额退还您支付的价格，退款发出后会通过电子邮件通知您。',
  'learnerCheckout.seatLost.back': '返回课程',
} satisfies Record<keyof typeof learnerCheckoutEn, string>
