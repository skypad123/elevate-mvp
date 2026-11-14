import type { CatalogSort } from '@elevate/core'
import { Search, SearchX } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { ScrollView, TextInput, View } from 'react-native'
import { CourseCard } from '@/components/CourseCard'
import { HeroScene } from '@/components/mascot/HeroScene'
import { TAB_BAR_HEIGHT } from '@/components/PillTabBar'
import { errorMessage } from '@/lib/api-error'
import { useCategories, useCourseList } from '@/lib/catalog'
import { useBreakpoint } from '@/lib/responsive'
import { useTheme } from '@/theme/ThemeProvider'
import { Button, Card, Chip, EmptyState, Grid, Screen, Skeleton, Text } from '@/ui'

export default function Explore() {
  const theme = useTheme()
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
              <Text variant={isMd ? 'display' : 'h1'}>
                Learn a craft from people who practise it.
              </Text>
              <Text variant="bodyLg" tone="secondary">
                Short, serious courses by independent teachers in Singapore. Pay once, learn at your
                pace, earn a certificate you can verify.
              </Text>
            </View>
            <HeroScene style={isLg ? undefined : { alignSelf: 'center' }} />
          </View>
        ) : null}

        <View style={{ gap: theme.space[3] }}>
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
              placeholder="Search courses or teachers"
              placeholderTextColor={theme.colors.inkTertiary}
              style={[theme.text.body, { flex: 1, color: theme.colors.ink, paddingVertical: 0 }]}
              returnKeyType="search"
              accessibilityLabel="Search courses"
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: theme.space[2], paddingVertical: 2 }}
          >
            <Chip label="All" selected={!category} onPress={() => setCategory(undefined)} />
            {(categories.data ?? []).map((c) => (
              <Chip
                key={c.slug}
                label={c.count ? `${c.label} · ${c.count}` : c.label}
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
                ? 'Loading'
                : `${items.length}${courses.hasNextPage ? '+' : ''} course${items.length === 1 ? '' : 's'}`}
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
              <Chip label="Newest" selected={sort === 'newest'} onPress={() => setSort('newest')} />
              <Chip
                label="Most enrolled"
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
            title="Could not load courses"
            body={errorMessage(courses.error)}
            action={{ label: 'Try again', onPress: () => courses.refetch() }}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No courses match"
            body="Try another search or category."
            action={{
              label: 'Clear filters',
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
                  label="Load more"
                  variant="secondary"
                  loading={courses.isFetchingNextPage}
                  onPress={() => courses.fetchNextPage()}
                />
              </View>
            ) : null}
          </View>
        )}
      </View>
    </Screen>
  )
}
