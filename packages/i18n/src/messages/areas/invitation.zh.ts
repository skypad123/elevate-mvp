import type { invitationEn } from './invitation.en'

export const invitationZh = {
  'invitation.notFound.title': '未找到邀请',
  'invitation.notFound.body': '此链接不是有效的邀请。请确认已完整复制邮件中的链接。',

  'invitation.almostThere.title': '就差一步',
  'invitation.almostThere.body':
    '您接受 {profile} 的邀请时使用的邮箱地址，与收到邀请的邮箱地址不同。已请所有者确认是您本人。所有者确认后，您会收到邮件通知。',

  'invitation.closed.expired.title': '此邀请已过期',
  'invitation.closed.expired.body': '邀请的有效期为 7 天。请联系邀请您的人重新发送。',
  'invitation.closed.revoked.title': '此邀请已失效',
  'invitation.closed.revoked.body':
    '该邀请已被撤销，或已被新的邀请取代。请查看收件箱中是否有较新的邮件，或请对方重新发送邀请。',
  'invitation.closed.accepted.title': '此邀请已被使用',
  'invitation.closed.accepted.body':
    '如果是您本人使用的，可以在 Elevate Teach 中您的账户下找到该教学档案。',
  'invitation.closed.awaiting_confirmation.title': '等待所有者确认',
  'invitation.closed.awaiting_confirmation.body':
    '使用此邀请的邮箱地址与收到邀请的邮箱地址不同。已请该教学档案的所有者确认。',
  'invitation.goToTeach': '前往 Elevate Teach',

  'invitation.badge': '邀请',
  'invitation.join.manager': '以管理员身份加入 {profile}',
  'invitation.join.writer': '以撰稿人身份加入 {profile}',
  'invitation.invitedBy.personal': '{name} 邀请您参与其在 Elevate 上的课程工作。',
  'invitation.invitedBy.corporate': '{name} 邀请您参与这家公司在 Elevate 上的课程工作。',
  'invitation.invitedBy.someone.personal': '有人邀请您参与其在 Elevate 上的课程工作。',
  'invitation.invitedBy.someone.corporate': '有人邀请您参与这家公司在 Elevate 上的课程工作。',
  'invitation.accept': '使用 {email} 接受邀请',
  'invitation.notYou': '不是您本人？请{signOut}，再用您想使用的邮箱地址登录。',
  'invitation.signInToAccept': '登录以接受邀请',
  'invitation.newHere': '第一次使用 Elevate？使用邮箱登录即会为您创建账户，无需设置密码。',
  'invitation.expires': '此邀请有效期至 {date}。',

  'invitation.toast.joined.manager': '您已以管理员身份加入 {profile}',
  'invitation.toast.joined.writer': '您已以撰稿人身份加入 {profile}',
  'invitation.toast.joined.writer.note':
    '您对已上线课程所做的修改，需经所有者或管理员批准后学员才能看到。',
} satisfies Record<keyof typeof invitationEn, string>
