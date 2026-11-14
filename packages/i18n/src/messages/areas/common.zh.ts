import type { commonEn } from './common.en'

export const commonZh = {
  'common.cancel': '取消',
  'common.save': '保存',
  'common.remove': '移除',
  'common.back': '返回',
  'common.tryAgain': '重试',
  'common.loading': '加载中…',
  'common.actions': '操作',
  'common.status': '状态',
  'common.role': '角色',
  'common.email': '邮箱',
  'common.name': '姓名',
  'common.free': '免费',
  'common.actionFailed': '操作未成功',
} satisfies Record<keyof typeof commonEn, string>
