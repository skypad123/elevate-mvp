/** Explore, the home tab, and the course card. */
export const learnerExploreEn = {
  'learnerExplore.hero.title': 'Learn a craft from people who practise it.',
  'learnerExplore.hero.body':
    'Short, serious courses by independent teachers in Singapore. Pay once, learn at your pace, earn a certificate you can verify.',

  'learnerExplore.search.placeholder': 'Search courses or teachers',
  // The search field's accessible name
  'learnerExplore.search.label': 'Search courses',

  // The category chip that clears the category filter
  'learnerExplore.category.all': 'All',
  // A category chip: {category} is the category's name, {count} the number of courses in it
  'learnerExplore.category.withCount': '{category} · {count}',

  // The result count while the list is loading
  'learnerExplore.count.loading': 'Loading',
  'learnerExplore.count.one': '{count} course',
  'learnerExplore.count.other': '{count} courses',
  // More pages exist, so {count} is at least a full page (12) and never 1
  'learnerExplore.count.more': '{count}+ courses',

  // Sort chips, by the stored sort value
  'learnerExplore.sort.newest': 'Newest',
  'learnerExplore.sort.popular': 'Most enrolled',

  'learnerExplore.error.title': 'Could not load courses',

  'learnerExplore.empty.title': 'No courses match',
  'learnerExplore.empty.body': 'Try another search or category.',
  'learnerExplore.empty.clear': 'Clear filters',

  'learnerExplore.loadMore': 'Load more',

  // The course card's footer: {enrolled} is the number of learners (shown beside a people icon),
  // {count} the number of lessons
  'learnerExplore.card.meta.one': '{enrolled} · {count} lesson',
  'learnerExplore.card.meta.other': '{enrolled} · {count} lessons',
} as const
