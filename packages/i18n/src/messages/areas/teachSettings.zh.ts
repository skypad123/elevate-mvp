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
  'membership.leave.stay': '暂不离开',
  'membership.leave.confirm': '离开',
  'membership.leave.done': '您已离开 {name}',
  'membership.leave.failed': '离开失败',

  'account.signedInAs': '当前登录账户',
  'account.owner': '所有者',

  'settings.teach.readOnly': '只有所有者或管理员可以修改学员看到的教学档案信息。',

  // The class-sales card: drafted by Claude; needs the author's sign-off, and the terms a
  // lawyer's reading, before production.
  'classSales.title': '班级销售',
  'classSales.description': '销售您定期班级的名额。接受暂缓结算条款之前，请先仔细阅读。',
  'classSales.badge.off': '未销售',
  'classSales.badge.switching': '正在完成设置',
  'classSales.badge.on': '正在销售班级',
  'classSales.badge.leaving': '正在停止',
  'classSales.loadFailed': '无法加载班级销售状态。',
  'classSales.notPayable': '请先在 Stripe 完成收款设置，再接受这些条款。',
  'classSales.leftBefore': '您已停止销售班级。您可以再次接受这些条款。',

  'classSales.terms.title': '暂缓结算条款',
  'classSales.terms.version': '版本 {version}',
  'classSales.terms.intro':
    '“您”指教学档案。“课次”指班级的一次有固定日期的上课。“您的份额”指学员所付价格减去 Elevate 的费用。',
  'classSales.terms.accepting': '接受条款的效果',
  'classSales.terms.leaving': '停止销售',
  'classSales.terms.paid': '何时向您结算',
  'classSales.terms.held': '班级款项何时暂缓结算',
  'classSales.terms.fee': 'Elevate 的费用',
  'classSales.terms.refunds': '退款，以及 Stripe 手续费由谁承担',
  'classSales.terms.refunds.intro': '付款被退款时，Stripe 不退还其支付手续费。',
  'classSales.terms.elevateCancels': 'Elevate 取消班级时',
  'classSales.terms.attended': '“出席”的含义',
  'classSales.terms.disputes': '学员银行的争议',
  'classSales.terms.owe': '您的欠款',
  'classSales.term.1':
    '只有教学档案的所有者可以接受这些条款。接受后，该教学档案即可销售其班级的名额。',
  'classSales.term.2':
    '自此以后，您 Stripe 账户中的款项何时转入您的银行账户由 Elevate 决定。这适用于您通过 Elevate 完成的每一笔销售，包括自定进度的课程。Stripe 不再自动向您结算。',
  'classSales.term.3': '您不能在 Stripe 控制台中更改结算周期，也不能自行发起结算。',
  'classSales.term.4':
    '所有者可以随时在 Teach 的设置中停止销售班级。自那一刻起，您的所有班级都不再开放报名。已售出的名额不受影响：这些班级照常进行，其款项按本条款暂缓结算和支付。',
  'classSales.term.5':
    '停止销售 30 天后，或者如果届时仍有班级款项在暂缓结算，则在更晚的时候，Elevate 会向您支付应付款项，并将结算交回 Stripe 自己的结算周期。完成后我们会发邮件通知您。您以后可以再次接受这些条款。',
  'classSales.term.6':
    'Elevate 每天最多向您结算一次，在新加坡时间 10:00 之后，且可结算金额至少为 S$1 时进行。',
  'classSales.term.7':
    '每次结算由完整的销售组成，从最早的一笔开始。当天的结算容纳不下的一笔销售会等到第二天，其后的销售也一样。',
  'classSales.term.8': '自定进度课程的销售款项，一旦 Stripe 将其计入您的可用余额，即可结算。',
  'classSales.term.9': '您接受条款时 Stripe 余额中已有的款项，会在同样的每日结算中支付给您。',
  'classSales.term.10':
    '一个班级名额中属于您的份额会保留在您的 Stripe 账户中暂缓结算，直到该班级最后一个课次结束 7 天后。如果班级被取消，则暂缓至取消 7 天后。',
  'classSales.term.11':
    '只要还有学员可以对表明其出席的标记提出异议，该班级的款项就不会解除暂缓。对于手动标记，学员有 7 天时间提出异议。',
  'classSales.term.12':
    '如果没有任何学员出席某个班级，Elevate 会在该班级的款项解除暂缓之前审查该班级。',
  'classSales.term.13':
    '某个名额的退款正在处理中，或学员的银行正在处理与该笔付款有关的争议时，该名额的款项继续暂缓结算。',
  'classSales.term.14':
    '任何一笔销售的款项，自付款起暂缓结算不超过 85 天。因此，只有在 75 天内结束的班级才能销售。',
  'classSales.term.15': 'Elevate 对每笔销售收取的费用由两部分组成：',
  'classSales.term.15.commission':
    '佣金：按您教学档案的佣金比例（除非 Elevate 与您另有约定，否则为 15%），以价格减去下述估算费用后的金额计算；',
  'classSales.term.15.estimate': 'Stripe 支付手续费的估算：价格的 3.4% 加 S$0.50。',
  'classSales.term.15.note':
    '无论学员以何种方式付款，估算费用都相同。Stripe 实际收取的手续费可能更低，例如通过 PayNow 付款（1.3%）；也可能更高，例如使用新加坡境外发行的银行卡付款（3.9% 加 S$0.50）。实际手续费较低时，差额归 Elevate；较高时，差额由 Elevate 承担。您在每笔销售中的份额不变。以 S$500 的名额为例，Elevate 的费用为 S$89.88，您的份额为 S$410.12。',
  'classSales.term.16.lead': '学员退出。',
  'classSales.term.16':
    '尚未出席的学员可以在第一个课次开始 7 天前退出，退款金额为价格减去 Stripe 手续费。您在该笔销售中的份额会被收回，您无需承担其他费用。',
  'classSales.term.17.lead': '名额售出后，您更改了某个课次的日期或时间。',
  'classSales.term.17':
    '每位持有名额的学员都会收到邮件。尚未出席的学员此后可以在班级开始前退出，并获得全额退款。以这种方式退款的每个名额，Stripe 手续费由您承担。',
  'classSales.term.18.lead': '您把学员转到另一个班级。',
  'classSales.term.18':
    '所有者或管理员可以把尚未出席的学员转到同一课程的另一个班级。学员会收到邮件，并享有与第 17 条相同的退出权利。',
  'classSales.term.19.lead': '您取消班级。',
  'classSales.term.19':
    '每位尚未出席的学员都会获得全额退款。您在这些销售中的份额会被收回，每笔的 Stripe 手续费由您承担。',
  'classSales.term.20':
    '对于已出席您所取消班级某一课次的学员，退还价格中尚未开始的课次所对应的部分。您的份额中相同比例的部分会被收回，Elevate 也会把其所收费用中相同比例的部分退还给您。Stripe 手续费由您和 Elevate 按相同比例承担。',
  'classSales.term.21': '班级款项解除暂缓后，您不能再取消该班级。请联系 Elevate。',
  'classSales.term.22.lead': '您主动退款。',
  'classSales.term.22':
    '在名额款项解除暂缓之前，所有者或管理员可以向学员退还其所付款项的任意部分。学员保留名额。Elevate 会把其所收费用中相同比例的部分退还给您。',
  'classSales.term.23.lead': '学员付款后未获得名额。',
  'classSales.term.23':
    '这发生在学员付款期间班级已满或已经开始时。学员会获得全额退款，费用由 Elevate 承担。',
  'classSales.term.24': 'Elevate 只有在以下情况下才可以取消您的班级：',
  'classSales.term.24.absent': '教师未到场，或无法授课；',
  'classSales.term.24.venue': '场地不安全或无法使用；',
  'classSales.term.24.rules': '您违反了 Elevate 的规则或有不诚实的行为；',
  'classSales.term.24.suspended': '您的教学档案被暂停；或',
  'classSales.term.24.law': '法律要求取消。',
  'classSales.term.25':
    '在时间允许时，Elevate 会在取消前通知您，并给您答复的机会。Elevate 总会告诉您取消的原因。',
  'classSales.term.26':
    'Elevate 取消班级时，每位学员都会获得全额退款，无论是否出席。您在这些销售中的份额会被收回。Stripe 手续费由 Elevate 承担。Elevate 收回的金额绝不会超过退款金额。',
  'classSales.term.27': '学员自行签到某个课次，即视为出席该课次。',
  'classSales.term.28':
    '讲师为学员手动标记出席，Elevate 已发邮件告知学员，且学员在 7 天内未提出异议，也视为出席该课次。',
  'classSales.term.29':
    '如果学员要求其银行撤销一笔银行卡付款，而银行裁定学员胜诉，您在该笔销售中的全部份额都会被收回。Stripe 手续费和银行的争议费用由 Elevate 承担。',
  'classSales.term.30': '如果银行裁定 Elevate 胜诉，您不受任何影响。',
  'classSales.term.31':
    '退款或银行的裁定可能会收回已经支付给您的款项，或者收回超过您 Stripe 余额的金额。这部分金额即为欠款，会先从您之后的结算中扣除，然后才支付其他款项。',
  'classSales.term.32':
    '如果您的结算未能抵清欠款，Elevate 可以要求您支付剩余金额。Elevate 会向您发送列明每一笔金额的对账单。您可以对其中任何一笔金额提出质疑。',

  'classSales.accept': '接受条款并开始销售班级',
  'classSales.accept.done': '您现在可以销售班级了',
  'classSales.accept.switching': '已接受条款，正在完成设置。',
  'classSales.accept.failed': '无法接受条款',
  'classSales.accept.termsChanged': '条款已更新，请重新加载本页查看。',

  'classSales.switching':
    'Elevate 正在把您的 Stripe 账户切换为由 Elevate 结算。这需要几分钟。完成后，您的班级即开放报名。',

  'classSales.accepted':
    '您已于 {date} 接受暂缓结算条款（版本 {version}）。您已发布的班级可以销售，Elevate 每天向您结算一次。',
  'classSales.terms.show': '阅读条款',
  'classSales.terms.hide': '收起条款',

  'classSales.leave': '停止销售班级',
  'classSales.leave.title': '要停止销售班级吗？',
  'classSales.leave.description':
    '从现在起，您的所有班级都不再开放报名。已售出的名额不受影响：这些班级照常进行，其款项按条款暂缓结算和支付。30 天后，或者如果届时仍有班级款项在暂缓结算，则在更晚的时候，Elevate 会向您支付应付款项，并将结算交回 Stripe 自己的结算周期。',
  'classSales.leave.keep': '继续销售',
  'classSales.leave.confirm': '停止销售班级',
  'classSales.leave.done': '您已停止销售班级',
  'classSales.leave.failed': '无法停止销售班级',
  'classSales.leaving':
    '您已于 {requested} 停止销售班级。您的所有班级都不再开放报名。在 {leaveOn}，或者如果届时仍有班级款项在暂缓结算，则在更晚的时候，Elevate 会向您支付应付款项，并将结算交回 Stripe 自己的结算周期。完成后我们会发邮件通知您。',
} satisfies Record<keyof typeof teachSettingsEn, string>
