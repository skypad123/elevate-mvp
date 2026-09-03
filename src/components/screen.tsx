import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ScrollView, YStack, type ScrollViewProps, type YStackProps } from 'tamagui'

type ScreenProps = YStackProps & {
  scroll?: boolean
  scrollProps?: ScrollViewProps
}

export function Screen({ children, scroll, scrollProps, ...props }: ScreenProps) {
  const insets = useSafeAreaInsets()

  return (
    <YStack
      flex={1}
      backgroundColor="$background"
      paddingTop={insets.top + 8}
      paddingBottom={scroll ? 0 : insets.bottom}
      {...props}
    >
      <YStack
        flex={1}
        width="100%"
        maxWidth={720}
        alignSelf="center"
        paddingHorizontal="$4"
      >
        {scroll ? (
          <ScrollView
            flex={1}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            showsVerticalScrollIndicator={false}
            {...scrollProps}
          >
            {children}
          </ScrollView>
        ) : (
          children
        )}
      </YStack>
    </YStack>
  )
}
