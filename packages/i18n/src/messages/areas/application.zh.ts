import type { applicationEn } from './application.en'

export const applicationZh = {
  'application.eyebrow.personal': '申请',
  'application.eyebrow.company': '公司申请',
  'application.title.applied': '审核中',
  'application.title.rejected': '尚未获批准',

  'application.rejected.body': '团队未能批准目前提交的这份申请。审核意见如下：',
  'application.editAndResubmit': '修改并重新提交',

  'application.reading.personal': '谢谢您，{name}。Elevate 团队的一位成员正在审阅这份申请。',
  'application.reading.company':
    '谢谢您，{name}。Elevate 团队的一位成员正在审阅这份申请，并对照您上传的商业档案核对 {legalName}（UEN {uen}）。',
  'application.emailNotice': '审核通常在两个工作日内完成，届时会有邮件发送至 {email}。',
  'application.sentences': '{first}{second}',
  'application.edit': '修改申请',
  'application.checkStatus': '刷新状态',

  'application.next.personal':
    '等待期间，不妨想一想您要制作的第一门课程。大多数试点教师从 3–5 个课时起步，每个课时配一段短视频、一页讲义和一个小测验。',
  'application.next.company':
    '获得批准后，还需完成两个步骤才能出售课程：公司连接自己的 Stripe 账户，Elevate 核对该账户上的法定名称与公司是否一致。',

  'companySetup.eyebrow': '正在设置 {name}',
  'companySetup.title': '开始销售前还需完成两个步骤',
  'companySetup.intro': '申请已批准。完成以下两个步骤后，公司即可收款，其课程也可供购买。',
  'companySetup.step.done': '已完成',
  'companySetup.step.waiting': '等待中',
  'companySetup.step.notStarted': '未开始',

  'companySetup.approved.title': '申请已批准',
  'companySetup.approved.body': '我们已对照商业档案核对了 {legalName}（UEN {uen}）。',

  'companySetup.stripe.title': '连接公司的 Stripe 账户',
  'companySetup.stripe.verified': 'Stripe 已验证该公司，可以代其收取款项。',
  'companySetup.stripe.notConnected':
    'Stripe 负责处理收款和提现。开通时须以公司名义办理，并使用公司自己的银行账户，大约需要十分钟。',
  'companySetup.stripe.unfinished': 'Stripe 的开通流程已经开始，但尚未完成。',
  'companySetup.stripe.verifying': 'Stripe 正在验证公司的资料，可能需要一两天。',
  'companySetup.stripe.continue': '继续开通 Stripe',
  'companySetup.stripe.ownerOnly': '只有教学档案的所有者（{email}）才能连接 Stripe。',

  'companySetup.name.title': 'Elevate 核对法定名称',
  'companySetup.name.matched': 'Stripe 账户上的法定名称是 {legalName}，与我们批准的公司一致。',
  'companySetup.name.checking':
    '我们正在核对 Stripe 账户上的法定名称是否为 {legalName}，即我们批准的公司。核对通常需要一个工作日，完成后会有邮件发送至 {email}。如果名称不一致，我们会说明需要修改的地方。',
  'companySetup.name.later':
    'Stripe 完成验证后，我们会核对 Stripe 账户上的法定名称是否为 {legalName}，即我们批准的公司。',
} satisfies Record<keyof typeof applicationEn, string>
