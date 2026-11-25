import type { learnerClassEn } from './learnerClass.en'

/** Drafted by Claude; to be reviewed and signed off by the author. */
export const learnerClassZh = {
  'learnerClass.list.title': '您的班级',
  'learnerClass.list.next': '下一节：{time}',
  'learnerClass.list.ended': '所有课节均已结束。',

  'learnerClass.block.time': '{day} {start}–{end}',
  'learnerClass.instant': '{day} {time}',

  'learnerClass.class.backToLearning': '我的学习',
  'learnerClass.class.loadError': '无法打开这个班级',
  'learnerClass.class.notFound': '您的班级中没有这个班级。',
  'learnerClass.class.course': '课程：{course}',
  'learnerClass.class.venue': '上课地点：{address}',
  'learnerClass.class.remote': '线上班级',
  'learnerClass.class.sessions': '课节',
  'learnerClass.class.checkIn': '签到',

  'learnerClass.state.marked_by_hand': '已出席（由讲师标记）',
  'learnerClass.state.present': '已出席',
  'learnerClass.state.present_flagged': '已出席（已标注）',
  'learnerClass.state.mark_voided': '标记已作废',
  'learnerClass.state.overturned': '签到已撤销',
  'learnerClass.state.not_arrived': '未签到',

  'learnerClass.flag.out_of_range': '您的位置离上课地点较远。',
  'learnerClass.flag.inaccurate': '您的位置信息不够精确。',
  'learnerClass.flag.denied': '您没有提供位置信息。',
  'learnerClass.flag.unavailable': '未能获取位置信息。',
  'learnerClass.flag.unsupported': '您是在 App 中签到的，App 不读取位置信息。',

  'learnerClass.mark.title': '讲师已将您标记为出席：{reason}',
  'learnerClass.markReason.phone_not_working': '手机无法使用',
  'learnerClass.markReason.no_phone': '没有手机',
  'learnerClass.markReason.no_network': '没有网络',
  'learnerClass.markReason.app_problem': 'App 出现问题',
  'learnerClass.markReason.other': '其他原因',

  'learnerClass.subState.upheld': '您对此标记提出了申诉，申诉结果为维持标记。',
  'learnerClass.subState.disputed': '您已对此标记提出申诉，正在审核中。',
  'learnerClass.subState.settled': '此标记的申诉期限已过。',
  'learnerClass.subState.open': '如果这不是您本人，您可以在 {date} 前提出申诉。',

  'learnerClass.overturn.title': '讲师撤销了此次签到：{reason}',
  'learnerClass.overturnReason.not_in_room': '不在教室内',
  'learnerClass.overturnReason.wrong_person': '由他人代为签到',
  'learnerClass.overturnReason.other': '其他原因',

  'learnerClass.dispute.action': '这不是我',
  'learnerClass.dispute.label': '请告诉教学团队发生了什么',
  'learnerClass.dispute.placeholder': '例如：我没有参加这节课。',
  'learnerClass.dispute.required': '请先写一段简短的说明，再提交申诉。',
  'learnerClass.dispute.submit': '提交申诉',
  'learnerClass.dispute.cancel': '取消',

  'learnerClass.checkIn.title': '课堂签到',
  'learnerClass.checkIn.loadError': '无法打开此签到页面',
  'learnerClass.checkIn.codeLabel': '签到码',
  'learnerClass.checkIn.codeFromLink': '已自动填入链接中的签到码。',
  'learnerClass.checkIn.typeCode': '请输入讲师屏幕上当前显示的签到码。',
  'learnerClass.checkIn.locationTitle': 'Elevate 为什么需要您的位置',
  'learnerClass.checkIn.locationBody':
    '您按下“签到”后，浏览器会询问一次您的位置，让讲师确认您在上课地点。您可以拒绝，仍然可以签到。',
  'learnerClass.checkIn.submit': '签到',
  'learnerClass.checkIn.done': '您已签到',
  'learnerClass.checkIn.already': '您已经签到过了',
  'learnerClass.checkIn.overturned': '您这节课的签到已被撤销，请联系讲师。',
  'learnerClass.checkIn.viewClass': '查看您的班级',
  'learnerClass.checkIn.myLearning': '我的学习',

  'learnerClass.checkIn.codeWrong.one':
    '签到码不正确，请输入当前显示的签到码。您还可以尝试 {count} 次。',
  'learnerClass.checkIn.codeWrong.other':
    '签到码不正确，请输入当前显示的签到码。您还可以尝试 {count} 次。',
  'learnerClass.checkIn.codeWrong.none':
    '签到码不正确。您暂时无法再尝试：请等待五分钟，再输入届时显示的签到码。',
  'learnerClass.checkIn.codeExpired.one':
    '此签到码已过期，请输入当前显示的签到码。您还可以尝试 {count} 次。',
  'learnerClass.checkIn.codeExpired.other':
    '此签到码已过期，请输入当前显示的签到码。您还可以尝试 {count} 次。',
  'learnerClass.checkIn.codeExpired.none':
    '此签到码已过期。您暂时无法再尝试：请等待五分钟，再输入届时显示的签到码。',
  'learnerClass.checkIn.lockedUntil': '签到码错误次数过多，请在 {time} 之后再试。',
  'learnerClass.checkIn.notOpenUntil': '这节课的签到将于 {time} 开放。',
  'learnerClass.checkIn.closedAt': '这节课的签到已于 {time} 结束。',

  'learnerClass.seat.title': '您的名额',
  'learnerClass.seat.moved': '教师已将您调到这个班级。我们已通过电子邮件将新的上课时间发送给您。',
  'learnerClass.seat.timesChanged':
    '您付款后，这个班级的上课时间有所更改。我们已通过电子邮件将原时间和新时间发送给您。',
  'learnerClass.seat.withdrawAmount':
    '您可以在 {date} 之前退出。我们将退还 {amount}，即您支付的价格扣除 Stripe 就您的付款收取的支付手续费。',
  'learnerClass.seat.withdrawRate':
    '您可以在 {date} 之前退出。我们将退还您支付的价格，扣除 Stripe 就您的付款收取的支付手续费：新加坡发行的银行卡为价格的 3.4% 加 S$0.50，新加坡境外发行的银行卡为 3.9% 加 S$0.50，PayNow 为 1.3%；如 Stripe 收取消费税（GST），则另加消费税。Stripe 报告后，这里会显示确切金额。',
  'learnerClass.seat.withdrawFullAmount':
    '由于班级有变动，您可以在班级于 {date} 开始前退出，我们将全额退还 {amount}。',
  'learnerClass.seat.withdrawFull':
    '由于班级有变动，您可以在班级于 {date} 开始前退出，我们将全额退还您支付的价格。',
  'learnerClass.seat.withdraw': '退出班级',
  'learnerClass.seat.confirmTitle': '要退出这个班级吗？',
  'learnerClass.seat.confirmBody': '您会立即失去名额，名额可能会转给其他人。此操作无法撤销。',
  'learnerClass.seat.confirm': '是的，退出',
  'learnerClass.seat.keep': '保留我的名额',
  'learnerClass.seat.closedTitle': '退出期限已过',
  'learnerClass.seat.closed':
    '退出期限已于第一节课开始前 7 天截止。现在是否退款由教师决定，请联系教师。',
  'learnerClass.seat.attended': '您已出席这个班级，是否退款由教师决定。',
  'learnerClass.seat.markOpen':
    '您已被手动标记为出席。在 {date} 之前，除非您先在下方对该标记提出申诉，否则不能退出。',

  'learnerClass.refund.onItsWay': '退款处理中',
  'learnerClass.refund.onItsWayAmount':
    '我们正在将 {amount} 退回您的原付款方式，退款发出后会通过电子邮件通知您。',
  'learnerClass.refund.onItsWayBody':
    '我们正在将款项退回您的原付款方式，退款发出后会通过电子邮件通知您。',
  'learnerClass.refund.refunded': '已退款',
  'learnerClass.refund.refundedBody':
    '我们已于 {date} 将 {amount} 退回您的原付款方式。退回银行卡的款项通常在 5 到 10 个工作日后显示在您的账单上。',
  'learnerClass.refund.bankReturned': '您的银行已将款项退还给您，因此无需再退款。',
  'learnerClass.refund.support': 'Elevate 支持团队已处理这笔退款。',
  'learnerClass.refund.withdrawn': '您已退出这个班级，不再拥有名额。',
  'learnerClass.refund.discretionary': '教师已为您退款，您仍保留名额。',

  'learnerClass.cancelled.title': '这个班级已取消',
  'learnerClass.cancelled.refundFull': '我们会全额退还您支付的价格。',
  'learnerClass.cancelled.refundPart':
    '您已出席部分课程，因此我们会退还取消时尚未开始的课节所对应的那部分价格。',
  'learnerClass.cancelled.markOpen':
    '您曾被手动标记为出席，您可以在 {date} 之前对该标记提出申诉。如果您提出申诉，我们会全额退还您支付的价格。如果您不提出申诉，该标记将计为出席，我们会退还尚未开始的课节所对应的那部分价格。',
  'learnerClass.cancelled.attended':
    '所有课节均已开始，且您被计为已出席，因此不予退款。如果您认为有误，请联系教师。',

  'learnerClass.signedOut.title': '登录后签到',
  'learnerClass.signedOut.body': '您可以在 Elevate App 中签到，也可以在此页面登录后签到。',
  'learnerClass.signedOut.openApp': '打开 Elevate App 并输入签到码',
  'learnerClass.signedOut.signIn': '在此登录',
  'learnerClass.signedOut.fallback': '如果没有反应，请在此登录',
} satisfies Record<keyof typeof learnerClassEn, string>
