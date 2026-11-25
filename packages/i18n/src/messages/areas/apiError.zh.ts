import type { apiErrorEn } from './apiError.en'

/** Drafted by Claude; reviewed and signed off by the author. */
export const apiErrorZh = {
  'apiError.invalid_session': '登录已过期，请重新登录。',
  'apiError.unauthorized': '请登录后继续。',
  'apiError.reauth_required': '此操作需要近期登录验证，请重新登录后继续。',
  'apiError.forbidden': '您没有访问权限。',
  'apiError.not_found': '找不到该内容，可能已被删除。',
  'apiError.validation': '您输入的内容有误，请检查后重试。',
  'apiError.rate_limited': '尝试次数过多，请几分钟后再试。',
  'apiError.payments_not_configured': '暂时无法付款，请稍后再试。',

  'apiError.link_invalid': '此登录链接或验证码无效，请重新获取。',
  'apiError.link_used': '此登录链接已被使用，请重新获取。',
  'apiError.link_expired': '此登录链接已过期，请重新获取。',
  'apiError.code_locked': '验证码错误次数过多，请重新获取。',
  'apiError.code_invalid': '验证码不正确，请查看邮件后重试。',

  'apiError.promo_invalid': '此优惠码无效。',
  'apiError.promo_wrong_course': '此优惠码不适用于这门课程。',
  'apiError.promo_not_started': '此优惠码尚未生效。',
  'apiError.promo_expired': '此优惠码已过期。',
  'apiError.promo_exhausted': '此优惠码已达使用次数上限。',
  'apiError.already_enrolled': '您已报名这门课程。',
  'apiError.teacher_not_payable': '这位教师暂时无法收款，请稍后再试。',
  'apiError.below_minimum': '使用此优惠码后，价格低于最低收费金额（{amount}）。',

  'apiError.enrollment_inactive': '此报名已失效。',
  'apiError.lesson_locked': '本课时尚未解锁，请先完成前面的课时。',
  'apiError.lesson_locked.after': '请先完成 {lessons}。',
  'apiError.asset_not_ready': '此文件仍在处理中，请几分钟后再试。',
  'apiError.quiz_completion': '测验需通过后才算完成。',
  'apiError.quiz_empty': '此测验暂无题目。',
  'apiError.already_passed': '您已通过此测验。',
  'apiError.no_attempts_left': '此测验的作答次数已用完。',
  'apiError.already_submitted': '本次作答已提交。',
  'apiError.attempt_expired': '本次作答已超时。',

  'apiError.not_complete': '完成课程即可获得证书。',

  // Scheduled classes: drafted by Claude, signed off by the author on 2026-11-24.
  'apiError.check_in_not_open': '本堂课尚未开放签到。',
  'apiError.check_in_closed': '本堂课的签到已结束。',
  'apiError.check_in_locked': '签到码错误次数过多，请几分钟后再试。',
  'apiError.check_in_code_wrong': '签到码不正确，请输入当前显示的签到码。',
  'apiError.check_in_code_expired': '此签到码已过期，请输入当前显示的签到码。',
  'apiError.check_in_overturned': '您本堂课的签到已被撤销，请联系讲师。',
  'apiError.dispute_window_closed': '申诉期限已过。',
  'apiError.already_disputed': '您已对此提出申诉。',

  // Selling a class: drafted by Claude; needs the author's sign-off before production.
  'apiError.class_not_on_sale': '这个班级暂不开放报名。',
  'apiError.class_full': '这个班级已满。',
  'apiError.already_in_class': '您已在这个班级中有名额。',
  'apiError.own_class': '您不能报名自己授课或管理的班级。',
  'apiError.class_requires_payment': '此优惠码不能用于班级。',
  'apiError.terms_changed': '退款条款已更新，请重新加载本页查看。',
  'apiError.too_many_reservations': '您为这个班级发起支付的次数过多，请稍后再试。',
  'apiError.withdrawal_closed': '这个班级的退出期限已过，请联系教师。',
  'apiError.withdrawal_attended': '您已出席这个班级，是否退款由教师决定。',
  'apiError.class_cancelled': '这个班级已取消，您的退款将随取消一并处理。',
  'apiError.refund_in_progress': '这个名额的退款已在处理中。',
  'apiError.seat_has_no_payment': '这个名额没有付款记录，因此没有可退的款项。请联系教师。',
} satisfies Record<keyof typeof apiErrorEn, string>
