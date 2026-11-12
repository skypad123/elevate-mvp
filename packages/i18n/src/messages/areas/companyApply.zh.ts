import type { companyApplyEn } from './companyApply.en'

export const companyApplyZh = {
  'companyApply.ownerOnly.title': '只有所有者可以重新提交',
  'companyApply.ownerOnly.body': '此公司档案的申请可由其所有者修改。',

  'companyApply.eyebrow.apply': '以公司身份授课',
  'companyApply.eyebrow.reapply': '更新您的申请',
  'companyApply.title': '为您的公司创建教学档案',
  'companyApply.intro':
    '适用于在新加坡注册的私人有限公司或有限责任合伙。课程以公司名义出售，款项支付到公司自己的 Stripe 账户。我们会先对照商业档案核对公司信息，再审核教学内容，通常在两个工作日内完成。',
  'companyApply.personalInstead': '以个人名义授课，或者您是独资经营者？请{link}。',
  'companyApply.personalInstead.link': '改为以个人身份申请',
  'companyApply.reviewerNote': '审核意见',

  'companyApply.company.title': '公司信息',
  'companyApply.uen.hint': '即机构识别号码，请按商业档案上的填写，格式如 {example}。',
  'companyApply.uen.invalid': '这不是此类公司的 UEN，格式应如 {example}。',
  'companyApply.legalName.hint': '注册名称，须与商业档案上的完全一致。',
  'companyApply.document.upload': '商业档案（PDF）',
  'companyApply.document.replace': '更换商业档案（PDF）',
  'companyApply.document.hint': '来自 ACRA Bizfile 的公司商业档案。只有 Elevate 团队会查看。',
  'companyApply.document.kept': '如果不上传新文件，将沿用上次申请时提交的文件。',
  'companyApply.document.required': '请上传 PDF 格式的公司商业档案',

  'companyApply.public.title': '向学员展示的信息',
  'companyApply.publicName': '公开名称',
  'companyApply.publicName.hint': '显示在课程和证书上，可以使用商号。',
  'companyApply.headline.hint': '写一句话即可，例如“职业陶艺师亲授的工作室陶艺课”。',
  'companyApply.about': '公司简介',
  'companyApply.about.hint': '50–3000 个字符。学员会在课程页面上看到这段介绍。',

  'companyApply.teaching.title': '教学',
  'companyApply.credentials': '资质与经验',
  'companyApply.credentials.hint': '由谁授课、他们有哪些资历，以及公司从事教学的年限。',
  'companyApply.sample.upload': '教学示例：上传视频',
  'companyApply.sample.upload.hint': '贵公司一位教师的授课片段，几分钟即可。支持 MP4 或 MOV 格式。',
  'companyApply.sample.link': '或提供教学示例的链接',

  'companyApply.agreement':
    '提交申请即表示您确认自己有权代表该公司行事，并同意教师协议：内容归公司所有；内容上线期间，Elevate 享有非排他性的托管许可。',
  'companyApply.submit.apply': '提交申请',
  'companyApply.submit.reapply': '重新提交',
  'companyApply.sent.title': '申请已提交',
  'companyApply.sent.description': '审核完成后，我们会发邮件通知您。',
  'companyApply.submit.failed': '提交失败',
} satisfies Record<keyof typeof companyApplyEn, string>
