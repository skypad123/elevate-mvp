import type { learnerCertificateEn } from './learnerCertificate.en'

/** Drafted by Claude; reviewed and signed off by the author. */
export const learnerCertificateZh = {
  'learnerCertificate.own.back': '返回课程',
  'learnerCertificate.own.notYet.title': '完成课程即可获得证书',
  'learnerCertificate.own.notYet.body':
    '请完成所有课时并通过所有测验。一旦完成，即会为您颁发证书。',
  'learnerCertificate.own.notYet.action': '返回课程',
  'learnerCertificate.own.loadFailed.title': '无法加载您的证书',
  'learnerCertificate.own.eyebrow': '您的证书',
  'learnerCertificate.own.title': '恭喜您完成课程！',
  'learnerCertificate.own.intro':
    '您可以下载 PDF，或分享验证链接。任何人打开此链接即可验证您的证书，无需登录；PDF 上也印有此链接及其二维码。',
  'learnerCertificate.own.noName.title': '在证书上印上您的姓名',
  'learnerCertificate.own.noName.body':
    '您的个人资料中尚未填写姓名，因此证书上显示的是您的邮箱。在“个人资料”中添加姓名后，此处的证书会自动更新，验证链接保持不变。',
  'learnerCertificate.own.noName.action': '前往“个人资料”',
  'learnerCertificate.own.verifyLink': '验证链接',

  'learnerCertificate.verify.loadFailed.title': '暂时无法查询此证书',
  'learnerCertificate.verify.revoked.title': '证书已撤销',
  'learnerCertificate.verify.revoked.body': '此证书已于 {date} 被 Elevate 撤销，不再有效。',
  'learnerCertificate.verify.notFound.title': '未找到证书',
  'learnerCertificate.verify.notFound.body':
    '没有与此链接对应的证书。请检查网址，或向证书持有人索取印在其 PDF 上的链接。',
  'learnerCertificate.verify.notFound.action': '浏览课程',
  'learnerCertificate.verify.title': '已验证的证书',
  'learnerCertificate.verify.body':
    'Elevate 确认此证书真实有效：{name} 已完成这门课程的所有课时并通过所有测验，证书随即颁发。任何人都可以通过此链接验证，无需创建账户。',
  'learnerCertificate.verify.viewCourse': '查看课程',

  'learnerCertificate.card.eyebrow': '结业证书',
  'learnerCertificate.card.statement':
    '兹证明 {name} 已在 Elevate 上完成由 {teacher} 讲授的课程 {course}',
  'learnerCertificate.card.id': '证书编号 {token}',
  'learnerCertificate.card.download': '下载 PDF',
  'learnerCertificate.card.share': '分享验证链接',
  'learnerCertificate.card.copied': '链接已复制',
  'learnerCertificate.card.shareTitle': 'Elevate 证书',
  'learnerCertificate.card.shareMessage': '我在 Elevate 上完成了“{course}”。点此验证：{url}',
} satisfies Record<keyof typeof learnerCertificateEn, string>
