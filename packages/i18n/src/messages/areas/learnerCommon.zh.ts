import type { learnerCommonEn } from './learnerCommon.en'

/** Drafted by Claude; reviewed and signed off by the author. */
export const learnerCommonZh = {
  'learnerCommon.language.label': '语言',

  'learnerCommon.error.generic': '出了点问题，请重试。',
  'learnerCommon.error.unreachable': '无法连接 Elevate，请检查网络连接。',
  'learnerCommon.error.retry': '重试',

  'learnerCommon.duration.minutes': '{minutes} 分钟',
  'learnerCommon.duration.hours': '{hours} 小时',
  'learnerCommon.duration.hoursMinutes': '{hours} 小时 {minutes} 分钟',

  'learnerCommon.list.separator': '、',

  'learnerCommon.price.free': '免费',

  'learnerCommon.notFound.title': '找不到此页面',
  'learnerCommon.notFound.body': '此链接可能已失效，或课程已下架。',
  'learnerCommon.notFound.back': '返回探索页',

  'learnerCommon.rootError.title': '出了点问题',
  'learnerCommon.rootError.body': '发生意外错误，此页面无法继续显示。',
} satisfies Record<keyof typeof learnerCommonEn, string>
