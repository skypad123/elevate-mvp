import type { learnerExploreEn } from './learnerExplore.en'

/** Drafted by Claude; reviewed and signed off by the author. */
export const learnerExploreZh = {
  'learnerExplore.hero.title': '向真正的从业者学一门手艺。',
  'learnerExplore.hero.body':
    '由新加坡独立教师开设的精炼而扎实的课程。一次付款，按自己的节奏学习，获得可验证的证书。',

  'learnerExplore.search.placeholder': '搜索课程或教师',
  'learnerExplore.search.label': '搜索课程',

  'learnerExplore.category.all': '全部',
  'learnerExplore.category.withCount': '{category} · {count}',

  'learnerExplore.count.loading': '加载中',
  'learnerExplore.count.one': '{count} 门课程',
  'learnerExplore.count.other': '{count} 门课程',
  'learnerExplore.count.more': '{count}+ 门课程',

  'learnerExplore.sort.newest': '最新',
  'learnerExplore.sort.popular': '报名最多',

  'learnerExplore.error.title': '无法加载课程',

  'learnerExplore.empty.title': '没有符合条件的课程',
  'learnerExplore.empty.body': '请尝试其他搜索词或分类。',
  'learnerExplore.empty.clear': '清除筛选',

  'learnerExplore.loadMore': '加载更多',

  'learnerExplore.card.meta.one': '{enrolled} · {count} 个课时',
  'learnerExplore.card.meta.other': '{enrolled} · {count} 个课时',
} satisfies Record<keyof typeof learnerExploreEn, string>
