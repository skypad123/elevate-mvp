import type { CatalogSort } from '@elevate/core'
import { Search, SearchX } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { ScrollView, TextInput, View } from 'react-native'
import { CourseCard } from '@/components/CourseCard'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { HeroScene } from '@/components/mascot/HeroScene'
import { TAB_BAR_HEIGHT } from '@/components/PillTabBar'
import { TeachBanner } from '@/components/TeachBanner'
import { useErrorMessage } from '@/lib/api-error'
import { useCategories, useCourseList } from '@/lib/catalog'
import { categoryName } from '@/lib/categories'
import { usePreferences } from '@/lib/preferences'
import { useBreakpoint } from '@/lib/responsive'
import { useTeachBanner } from '@/lib/teach-banner'
import { useTheme } from '@/theme/ThemeProvider'
import { Button, Card, Chip, EmptyState, Grid, Screen, Skeleton, Text } from '@/ui'

export default function Explore() {
  const theme = useTheme()
  const { t } = usePreferences()
  const errorMessage = useErrorMessage()
  const { isWideWeb, isMd, isLg } = useBreakpoint()
  const [query, setQuery] = useState('')
  const [q, setQ] = useState('')
  const [category, setCategory] = useState<string | undefined>(undefined)
  const [sort, setSort] = useState<CatalogSort>('newest')
  const categories = useCategories()
  const courses = useCourseList({ q, category, sort })

  useEffect(() => {
    const id = setTimeout(() => setQ(query.trim()), 350)
    return () => clearTimeout(id)
  }, [query])

  const items = courses.data?.pages.flatMap((p) => p.items) ?? []
  const columns = isLg ? 3 : isMd ? 2 : 1
  const searching = q.length > 0 || !!category
  // The invitation to teach, after the list: only once the first page has loaded (an empty list
  // included), and never while a search or category is active.
  const teachBanner = useTeachBanner({
    searching,
    loaded: !courses.isPending && !courses.isError,
  })

  return (
    <Screen bottomInset={isWideWeb ? 0 : TAB_BAR_HEIGHT}>
      <View style={{ gap: theme.space[6] }}>
        {!searching ? (
          // The hero bounds Pip's scene: no frame of its own, clipped by this view.
          <View
            style={{
              flexDirection: isLg ? 'row' : 'column',
              alignItems: isLg ? 'center' : 'stretch',
              gap: isLg ? theme.space[8] : theme.space[4],
              overflow: 'hidden',
            }}
          >
            <View style={{ gap: theme.space[3], maxWidth: 720, flex: isLg ? 1 : undefined }}>
              <Text variant="eyebrow" tone="brand">
                Elevate
              </Text>
              <Text variant={isMd ? 'display' : 'h1'}>{t('learnerExplore.hero.title')}</Text>
              <Text variant="bodyLg" tone="secondary">
                {t('learnerExplore.hero.body')}
              </Text>
            </View>
            <HeroScene style={isLg ? undefined : { alignSelf: 'center' }} />
          </View>
        ) : null}

        <View style={{ gap: theme.space[3] }}>
          <LanguageSwitch />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space[3],
              height: 52,
              paddingHorizontal: theme.space[4],
              borderRadius: theme.radii.pill,
              borderWidth: 1,
              borderColor: theme.colors.borderStrong,
              backgroundColor: theme.colors.surface,
            }}
          >
            <Search size={18} color={theme.colors.inkTertiary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('learnerExplore.search.placeholder')}
              placeholderTextColor={theme.colors.inkTertiary}
              style={[theme.text.body, { flex: 1, color: theme.colors.ink, paddingVertical: 0 }]}
              returnKeyType="search"
              maxLength={100}
              accessibilityLabel={t('learnerExplore.search.label')}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: theme.space[2], paddingVertical: 2 }}
          >
            <Chip
              label={t('learnerExplore.category.all')}
              selected={!category}
              onPress={() => setCategory(undefined)}
            />
            {(categories.data ?? []).map((c) => (
              <Chip
                key={c.slug}
                label={
                  c.count
                    ? t('learnerExplore.category.withCount', {
                        category: categoryName(c.slug, t),
                        count: c.count,
                      })
                    : categoryName(c.slug, t)
                }
                selected={category === c.slug}
                onPress={() => setCategory(category === c.slug ? undefined : c.slug)}
              />
            ))}
          </ScrollView>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text variant="eyebrow" tone="tertiary">
              {courses.isPending
                ? t('learnerExplore.count.loading')
                : courses.hasNextPage
                  ? t('learnerExplore.count.more', { count: items.length })
                  : t(
                      items.length === 1
                        ? 'learnerExplore.count.one'
                        : 'learnerExplore.count.other',
                      {
                        count: items.length,
                      },
                    )}
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
              <Chip
                label={t('learnerExplore.sort.newest')}
                selected={sort === 'newest'}
                onPress={() => setSort('newest')}
              />
              <Chip
                label={t('learnerExplore.sort.popular')}
                selected={sort === 'popular'}
                onPress={() => setSort('popular')}
              />
            </View>
          </View>
        </View>

        {courses.isPending ? (
          <Grid columns={columns} gap={theme.space[5]}>
            {['a', 'b', 'c'].map((k) => (
              <Card key={k} padded={false}>
                <Skeleton height={180} radius={0} />
                <View style={{ padding: theme.space[4], gap: theme.space[2] }}>
                  <Skeleton width="40%" height={12} />
                  <Skeleton width="85%" height={20} />
                  <Skeleton width="60%" height={14} />
                </View>
              </Card>
            ))}
          </Grid>
        ) : courses.isError ? (
          <EmptyState
            tone="danger"
            title={t('learnerExplore.error.title')}
            body={errorMessage(courses.error)}
            action={{ label: t('learnerCommon.error.retry'), onPress: () => courses.refetch() }}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={t('learnerExplore.empty.title')}
            body={t('learnerExplore.empty.body')}
            action={{
              label: t('learnerExplore.empty.clear'),
              onPress: () => {
                setQuery('')
                setCategory(undefined)
              },
            }}
          />
        ) : (
          <View style={{ gap: theme.space[5] }}>
            <Grid columns={columns} gap={theme.space[5]}>
              {items.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </Grid>
            {courses.hasNextPage ? (
              <View style={{ alignItems: 'center' }}>
                <Button
                  label={t('learnerExplore.loadMore')}
                  variant="secondary"
                  loading={courses.isFetchingNextPage}
                  onPress={() => courses.fetchNextPage()}
                />
              </View>
            ) : null}
          </View>
        )}

        {teachBanner.visible ? <TeachBanner onDismiss={teachBanner.dismiss} /> : null}
        {/* The end of the page, for the device flow to scroll to when the banner is hidden. */}
        <View testID="explore-end" style={{ height: 1 }} />
      </View>
    </Screen>
  )
}
