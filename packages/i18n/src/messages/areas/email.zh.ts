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

  // Classes: drafted by Claude; needs the author's sign-off before production.
  'email.class.block': '{date}，{start}–{end}',
  'email.class.instant': '{day} {time}',

  'email.classReceipt.title': '您已报名班级：{className}',
  'email.classReceipt.paid':
    '感谢您的购买。您已支付 {amount}，获得 {teacher} 的“{course}”课程班级“{className}”的一个名额。',
  'email.classReceipt.when': '上课时间如下（{timeZone}）：',
  'email.classReceipt.where': '地点：{address}',
  'email.classReceipt.online': '本班级在线授课，讲师会通过电子邮件告诉您如何加入。',
  'email.classReceipt.terms':
    '只要您尚未出席任何课节，您可以在 {date} 之前退出，我们会退还您支付的价格，扣除 Stripe 就您的付款收取的支付手续费；该日期之后，您不能再退出并获得退款。',
  'email.classReceipt.button': '查看班级',

  'email.seatLost.title': '未能获得“{className}”的名额，款项已退回',
  'email.seatLost.lost':
    '您为“{className}”支付的名额费用到账时，名额已不再可用，因此您未获得名额。',
  'email.seatLost.refunded':
    '我们已将全部 {amount} 退回您的原付款方式。款项可能需要 5–10 个工作日到账。',
  'email.seatLost.button': '前往课程',

  'email.classTimesChanged.title': '“{className}”的上课时间已更改',
  'email.classTimesChanged.changed': '教师已更改您所报名班级“{className}”的上课时间。',
  'email.classTimesChanged.before': '原上课时间（{timeZone}）：',
  'email.classTimesChanged.after': '新上课时间（{timeZone}）：',
  'email.classTimesChanged.withdraw':
    '如果新的时间不适合您，您可以在班级开始前，在 Elevate 的班级页面上退出，并获得全额退款。',
  'email.classTimesChanged.button': '查看班级',

  'email.manualMark.title': '您已被标记为出席：{className}',
  'email.manualMark.marked': '教师已为您手动标记出席“{className}”的 {block} 课次。',
  'email.manualMark.dispute':
    '如果您当时不在场，请在 {date} 之前在 Elevate 的班级页面上提出异议。此后该标记将计为出席，本班级是否退款由教师决定。',
  'email.manualMark.button': '查看班级',

  'email.classCancelled.title': '班级已取消：{className}',
  'email.classCancelled.cancelled': '“{className}”已取消。',
  'email.classCancelled.refunded':
    '我们已将 {amount} 退回您的原付款方式。款项可能需要 5–10 个工作日到账。',
  'email.classCancelled.refundedPart':
    '您已参加部分课程，因此我们已将未授课课次对应的 {amount} 退回您的原付款方式。款项可能需要 5–10 个工作日到账。',
  'email.classCancelled.button': '查看班级',

  'email.classCancelledAttended.title': '班级已取消：{className}',
  'email.classCancelledAttended.body':
    '“{className}”已取消。所有课次均已开始，且您被计为已出席，因此不予退款。如果您认为有误，请联系教师。',
  'email.classCancelledAttended.button': '查看班级',

  'email.classCancelledMarkOpen.title': '班级已取消：{className}',
  'email.classCancelledMarkOpen.body':
    '“{className}”已取消。您曾被手动标记为出席，您可以在 {date} 之前对该标记提出异议。',
  'email.classCancelledMarkOpen.refund':
    '如果您提出异议，您的全部付款将被退回。如果您不提出异议，该标记将计为出席，只会退回未授课课次对应的部分。',
  'email.classCancelledMarkOpen.button': '查看班级',

  'email.seatWithdrawn.title': '您已退出：{className}',
  'email.seatWithdrawn.withdrawn': '您已退出“{className}”，不再拥有该班级的名额。',
  'email.seatWithdrawn.refundedLessFee':
    '我们已将 {amount}（您的付款扣除支付手续费）退回您的原付款方式。款项可能需要 5–10 个工作日到账。',
  'email.seatWithdrawn.refundedFull':
    '我们已将全部 {amount} 退回您的原付款方式。款项可能需要 5–10 个工作日到账。',
  'email.seatWithdrawn.button': '前往课程',

  'email.seatRefunded.title': '“{className}”的退款',
  'email.seatRefunded.refunded':
    '“{className}”的教师已将 {amount} 退回您的原付款方式。款项可能需要 5–10 个工作日到账。',
  'email.seatRefunded.kept': '您仍保留该班级的名额。',
  'email.seatRefunded.button': '查看班级',

  'email.seatMoved.title': '您的班级已更改：{className}',
  'email.seatMoved.moved': '教师已将您从“{fromClass}”调到“{course}”课程的另一个班级“{className}”。',
  'email.seatMoved.when': '新班级的上课时间如下（{timeZone}）：',
  'email.seatMoved.withdraw':
    '由于您的班级已更改，您可以在新班级开始前，在 Elevate 的班级页面上退出，并获得全额退款。',
  'email.seatMoved.button': '查看班级',
} satisfies Record<keyof typeof emailEn, string>
