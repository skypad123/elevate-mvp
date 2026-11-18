import type { personalApplyEn } from './personalApply.en'

/** Drafted by Claude; to be reviewed and signed off by the author. */
export const personalApplyZh = {
  'personalApply.eyebrow.apply': '成为教师',
  'personalApply.eyebrow.reapply': '更新您的申请',
  'personalApply.title': '传授您亲身实践的技艺。',
  'personalApply.intro':
    'Elevate 是一个规模精小、经过甄选的平台。请告诉我们您是谁、教什么，并让我们看看您几分钟的授课片段。每份申请都由专人审核，通常在两个工作日内完成。',
  'personalApply.companyInstead':
    '此申请适用于以个人名义授课的人士，包括独资经营者。以私人有限公司或有限责任合伙企业的名义授课？请{link}。',
  'personalApply.companyInstead.link': '改为以公司身份申请',
  'personalApply.reviewerNote': '审核意见',

  'personalApply.loadFailed.title': '无法加载您的申请',

  'personalApply.about.title': '关于您',
  'personalApply.displayName.hint': '显示在您的课程和证书上。',
  'personalApply.headline.hint': '写一句话即可，例如“陶艺家，Jalan Bahar 工作室教师”。',
  'personalApply.bio.hint': '50–3000 个字符。学员会在您的课程页面上看到这段介绍。',

  'personalApply.experience.title': '资质与经验',
  'personalApply.credentials': '资质',
  'personalApply.credentials.hint': '您的资格证书、从业年限，以及曾经任教的地方。',

  'personalApply.sample.title': '教学示例',
  'personalApply.sample.intro': '上传一段您授课的短视频，或粘贴视频链接，两种方式都可以。',
  'personalApply.sample.upload': '上传视频',
  'personalApply.sample.upload.hint': '支持 MP4 或 MOV 格式，几分钟即可',
  'personalApply.sample.kept': '除非您上传新的视频，否则将沿用上次申请时的视频。',
  'personalApply.sample.link': '或提供链接',
  'personalApply.sample.link.placeholder': 'https://youtube.com/…',

  'personalApply.agreement':
    '提交申请即表示您同意教师协议：内容归您所有；内容上线期间，Elevate 享有非排他性的托管许可。',
  'personalApply.submit.apply': '提交申请',
  'personalApply.submit.reapply': '重新提交',
  'personalApply.sent.title': '申请已提交',
  'personalApply.sent.description': '审核完成后，我们会发邮件通知您。',
  'personalApply.submit.failed': '提交失败',
} satisfies Record<keyof typeof personalApplyEn, string>
