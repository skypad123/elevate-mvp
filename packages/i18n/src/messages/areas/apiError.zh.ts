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
} satisfies Record<keyof typeof apiErrorEn, string>
