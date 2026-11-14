import type { supportRecoveryEn } from './supportRecovery.en'

// "Officer" (a director of a company, a partner of an LLP) is 负责人: 高级职员 would leave out
// partners.
export const supportRecoveryZh = {
  'recovery.open.personal': '更改所有者的邮箱',
  'recovery.open.company': '指定新所有者',

  'recovery.personal.title': '更改所有者的邮箱地址',
  'recovery.personal.description':
    '适用于所有者无法再以 {email} 登录的情况。请务必确认请求人的身份：谁能查收新地址的邮件，谁就将取得该档案及其课程和收入。',
  'recovery.personal.newEmail': '新邮箱地址',
  'recovery.personal.newEmail.hint': '该地址不得属于其他 Elevate 账户。',
  'recovery.personal.effects':
    '所有者将在所有设备上被退出登录，此后使用新地址登录。新旧两个地址都会收到邮件通知。此项更改会在您的名下记入审计日志。',
  'recovery.personal.confirm': '更改邮箱地址',

  'recovery.company.title': '指定新所有者',
  'recovery.company.description':
    '适用于公司所有者（{email}）已离开公司或无法登录的情况。{company} 的一名负责人必须以书面形式授权此项更改。',
  'recovery.company.newOwner': '新所有者',
  'recovery.company.newOwner.hint':
    '按邮箱或姓名搜索。新所有者需要有 Elevate 账户：请让对方先登录一次 Teach。',
  'recovery.company.searching': '搜索中…',
  'recovery.company.noMatch': '没有其他账户与“{search}”匹配。',
  'recovery.company.managerHere': '本档案的管理员',
  'recovery.company.writerHere': '本档案的撰稿人',
  'recovery.company.newOwner.change': '更换',
  'recovery.company.authorisation': '公司负责人授权书（PDF）',
  'recovery.company.authorisation.hint':
    '由公司董事或合伙人签署并写明新所有者的信函。该文件会随审计记录一并保存。',
  'recovery.company.removePrevious': '将 {email} 从档案中移除',
  'recovery.company.removePrevious.hint':
    '如不勾选，原所有者将以管理员身份留在档案中。无论是否勾选，原所有者都会被退出登录。',
  'recovery.company.effects': '双方都会收到邮件通知。此项更改会在您的名下记入审计日志。',
  'recovery.company.confirm': '更改所有者',

  'recovery.toast.emailChanged': '所有者的邮箱已更改',
  'recovery.toast.ownerChanged': '所有者已更改',
  'recovery.toast.emailed': '已向两个邮箱地址发送通知邮件。',
  'recovery.toast.failed': '所有者恢复失败',
} satisfies Record<keyof typeof supportRecoveryEn, string>
