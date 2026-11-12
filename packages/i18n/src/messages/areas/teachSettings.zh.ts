import type { teachSettingsEn } from './teachSettings.en'

export const teachSettingsZh = {
  'settings.teach.save': '保存更改',
  'settings.teach.saved': '教学档案已保存',
  'settings.teach.saveFailed': '保存失败',

  'settings.teach.picture': '头像',
  'settings.teach.picture.description':
    '显示在课程页面上您的名称旁边。建议使用正方形的 JPG、PNG 或 WebP 图片。',
  'settings.teach.picture.remove': '移除头像',
  'settings.teach.picture.upload': '上传头像',
  'settings.teach.picture.replace': '更换头像',
  'settings.teach.picture.saved': '头像已保存',
  'settings.teach.picture.removed': '头像已移除',
  'settings.teach.picture.saveFailed': '头像保存失败',

  'membership.yourRole': '您的角色：{role}',
  'membership.leave': '离开此教学档案',
  'membership.leave.title': '要离开 {name} 吗？',
  'membership.leave.description':
    '您将立即失去对此教学档案及其课程的访问权限。您撰写的内容会保留在档案中。如需重新加入，需要获得新的邀请。',
  'membership.leave.stay': '留下',
  'membership.leave.confirm': '离开',
  'membership.leave.done': '您已离开 {name}',
  'membership.leave.failed': '离开失败',

  'account.signedInAs': '登录账户',
  'account.owner': '所有者',
} satisfies Record<keyof typeof teachSettingsEn, string>
