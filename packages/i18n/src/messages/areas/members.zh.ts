import type { membersEn } from './members.en'

export const membersZh = {
  'members.eyebrow': '成员',
  'members.title': '成员',
  'members.description': '与您一起参与此教学档案课程工作的人。每个人都使用自己的账户登录。',

  'members.noAccess.title': '成员由所有者管理',
  'members.noAccess.body': '您在此教学档案中的角色无权查看成员列表。',

  'members.list.title': '此教学档案中的人员',
  'members.list.loadFailed': '无法加载成员',
  'members.list.person': '人员',
  'members.list.added': '添加日期',
  'members.list.roleOf': '{name} 的角色',
  'members.list.addedBy': '由 {name} 添加',
  'members.list.empty': '还没有其他人。邀请一位撰稿人，协助您制作课程。',

  'members.invitations.title': '邀请',
  'members.invitations.sentTo': '发送至',
  'members.invitations.invitedBy': '由 {name} 邀请',
  'members.invitations.needsConfirmation': '待确认',
  'members.invitations.acceptedElsewhere':
    '已通过另一个邮箱地址接受：{email}。在所有者确认之前，对方还不是成员。',
  'members.invitations.acceptedElsewhere.unknown':
    '已通过另一个邮箱地址接受（地址未知）。在所有者确认之前，对方还不是成员。',
  'members.invitations.waiting': '待接受',
  'members.invitations.expires': '链接有效期至 {date}',
  'members.invitations.confirm': '确认',
  'members.invitations.resend': '重新发送',
  'members.invitations.revoke': '撤销',

  'members.invite.title': '邀请成员',
  'members.invite.description':
    '对方会收到一封带有链接的邮件，用自己的邮箱地址登录后即可接受邀请。',
  'members.invite.joinsAs': '对方将以{role}身份加入。{summary}',
  'members.invite.joinsAs.writer': '撰稿人',
  'members.invite.submit': '发送邀请',

  'members.readOnly.title': '仅可查看',
  'members.readOnly.description':
    '您可以查看此教学档案中有哪些人。邀请和移除成员由所有者和管理员负责。',

  'members.roles.title': '各角色的权限',

  'members.remove.title': '要移除 {name} 吗？',
  'members.remove.description':
    '该成员将立即失去对此教学档案的访问权限。其参与过的课程和文件仍保留在档案中，其等待批准的更改也会保留。',

  'members.toast.role.manager': '{name} 现在是管理员',
  'members.toast.role.writer': '{name} 现在是撰稿人',
  'members.toast.resent': '已重新发送至 {email}',
  'members.toast.revoked': '邀请已撤销',
  'members.toast.removed': '已移除 {name}',
  'members.toast.invited': '邀请已发送至 {email}',
  'members.toast.invited.description': '邮件中的链接 7 天内有效。',
  'members.toast.inviteFailed': '发送失败',

  'members.list.changeRole': '更改角色',
  'members.changeRole.title.manager': '要将 {name} 设为管理员吗？',
  'members.changeRole.title.writer': '要将 {name} 设为撰稿人吗？',
  'members.changeRole.confirm.manager': '设为管理员',
  'members.changeRole.confirm.writer': '设为撰稿人',

  'members.confirmInvite.title': '要授予 {email} 访问权限吗？',
  'members.confirmInvite.description':
    '邀请发送至 {invited}，但由 {accepted} 接受。请仅在确认这就是您要邀请的人时再确认。',
  'members.confirmInvite.description.unknown':
    '邀请发送至 {invited}，但由另一个邮箱地址接受。请仅在确认接受者身份时再确认。',

  'members.revoke.title': '要撤销发给 {email} 的邀请吗？',
  'members.revoke.description': '邮件中的链接将立即失效。您之后可以重新邀请对方。',
} satisfies Record<keyof typeof membersEn, string>
