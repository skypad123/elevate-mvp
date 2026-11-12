import type { supportProfilesEn } from './supportProfiles.en'

export const supportProfilesZh = {
  'profiles.eyebrow': '档案',
  'profiles.title': '教学档案',
  'profiles.description': '审核申请，批准或拒绝，并查找任何销售课程的档案。',

  'profiles.tab.applications': '申请',
  'profiles.tab.teachers': '教师',
  'profiles.tab.rejected': '已拒绝',
  'profiles.tab.all': '全部档案',

  'profiles.search.placeholder': '搜索档案、所有者、UEN 或法定名称',

  'profiles.loadError': '无法加载档案',
  'profiles.empty.title': '这里没有档案',
  'profiles.empty.search': '没有与该搜索匹配的档案。',
  'profiles.empty.list': '此列表暂时为空。',

  'profiles.column.profile': '档案',
  'profiles.column.type': '类型',
  'profiles.column.payments': '收款',
  'profiles.column.applied': '申请日期',

  'profiles.payable.yes': '可收款',
  'profiles.payable.no': '暂不可收款',
} satisfies Record<keyof typeof supportProfilesEn, string>
