import type { learnerCourseEn } from './learnerCourse.en'

/** Drafted by Claude; reviewed and signed off by the author. */
export const learnerCourseZh = {
  'learnerCourse.notFound.title': '未找到课程',
  'learnerCourse.notFound.back': '返回探索页',
  'learnerCourse.back': '探索',

  'learnerCourse.badge.enrolled': '已报名',

  'learnerCourse.cta.eyebrowEnrolled': '您已报名',
  'learnerCourse.cta.eyebrow': '一次付款，永久有效',
  'learnerCourse.cta.continue': '继续学习',
  'learnerCourse.cta.enrolFree': '免费报名',
  'learnerCourse.cta.enrolPrice': '报名 · {price}',
  'learnerCourse.cta.enrolOnWeb': '在网页上报名',
  'learnerCourse.cta.fees': '所有费用均已包含。由 Stripe 提供安全支付。',
  'learnerCourse.cta.cancelled': '付款已取消。您可以随时重试。',
  'learnerCourse.cta.nativeNote': '结账页面会在浏览器中打开，付款完成后，您的报名会显示在这里。',

  'learnerCourse.lessons.one': '{count} 个课时',
  'learnerCourse.lessons.other': '{count} 个课时',
  'learnerCourse.items.one': '{count} 项内容',
  'learnerCourse.items.other': '{count} 项内容',
  'learnerCourse.facts.lessonsItems': '{lessons} · {items}',
  'learnerCourse.facts.duration': '约 {duration}',
  'learnerCourse.facts.selfPaced': '自定进度',
  'learnerCourse.facts.enrolled': '{count} 人已报名',

  'learnerCourse.learn.title': '课程内容',
  'learnerCourse.lesson.itemsDuration': '{items} · {duration}',
  'learnerCourse.about.title': '关于这门课程',
  'learnerCourse.teacher.eyebrow': '授课教师',

  // Classes: drafted by Claude; signed off by the author on 2026-11-27.
  'learnerCourse.class.title': '以班级形式学习',
  'learnerCourse.class.intro':
    '班级是由讲师在所示日期现场讲授的本课程。班级名额需单独购买，不包含自学课程。',
  'learnerCourse.class.instructor': '讲师：{name}',
  'learnerCourse.class.venue': '上课地点：{address}',
  'learnerCourse.class.remote': '线上班级',
  'learnerCourse.class.seatsLeft.one': '剩余 {count} 个名额',
  'learnerCourse.class.seatsLeft.other': '剩余 {count} 个名额',
  'learnerCourse.class.full': '这个班级已满。',
  'learnerCourse.class.book': '报名这个班级 · {price}',
  'learnerCourse.class.bookOnWeb': '在网页上报名',
  'learnerCourse.class.nativeNote':
    '报名时会在浏览器中打开本页面，并选好这个班级。报名后，您的名额会显示在这里。',
  'learnerCourse.class.haveSeat': '您已有名额',
  'learnerCourse.class.viewSeat': '查看您的班级',
  'learnerCourse.class.seatElsewhere': '您在本课程的一个班级中有名额。',
  'learnerCourse.class.cancelled':
    '付款已取消，系统不再为您保留名额。在仍有名额时，您可以再次报名。',
} satisfies Record<keyof typeof learnerCourseEn, string>
