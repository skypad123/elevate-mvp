import type { teachShellEn } from './teachShell.en'

export const teachShellZh = {
  'switcher.label': '教学档案',
  'switcher.ariaLabel': '切换教学档案',
  'switcher.placeholder': '您的教学档案…',
  'switcher.option.staff': '{name}（以员工身份）',
  'switcher.option.applied': '{name}（审核中）',
  'switcher.option.rejected': '{name}（未获批准）',
  'switcher.createCompany': '+ 创建公司档案…',

  'staffBanner.title': '您正在以 Elevate 员工身份操作。',
  'staffBanner.body':
    '这是 {name} 的教学档案，不是您自己的。您可以修正内容并查看档案；价格、发布和收款仍由教师负责。您所做的每项更改都会记录在您的名下。',
  'staffBanner.sentences': '{first}{second}',

  'profileNotFound.title': '未找到教学档案',
  'profileNotFound.body': '此教学档案不存在，或者您的账户不是其成员。',
  'profileNotFound.action': '前往您的教学档案',
} satisfies Record<keyof typeof teachShellEn, string>
