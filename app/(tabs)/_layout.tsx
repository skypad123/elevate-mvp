import Ionicons from '@expo/vector-icons/Ionicons'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Tabs } from 'expo-router'
import { TouchableOpacity } from 'react-native'
import { Paragraph, useTheme, XStack, YStack } from 'tamagui'

function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme()

  return (
    <YStack paddingHorizontal="$4" paddingBottom="$4">
      <XStack
        backgroundColor="$background"
        borderRadius="$6"
        paddingVertical="$3"
        paddingHorizontal="$2"
        alignItems="center"
        justifyContent="space-around"
        elevation={8}
        shadowColor="#000"
        shadowOffset={{ width: 0, height: 4 }}
        shadowOpacity={0.15}
        shadowRadius={12}
        borderWidth={1}
        borderColor="$color4"
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
                ? options.title
                : route.name

          const isFocused = state.index === index

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params)
            }
          }

          const iconColor = isFocused ? theme.accent8?.val : theme.color9?.val

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              style={{ flex: 1, alignItems: 'center' }}
            >
              <YStack alignItems="center" gap="$1">
                {options.tabBarIcon?.({ focused: isFocused, color: iconColor, size: 24 })}
                <Paragraph
                  fontSize={10}
                  letterSpacing={1.2}
                  textTransform="uppercase"
                  color={iconColor}
                >
                  {typeof label === 'string' ? label : ''}
                </Paragraph>
              </YStack>
            </TouchableOpacity>
          )
        })}
      </XStack>
    </YStack>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: 92,
        },
      }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Courses',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="week"
        options={{
          title: 'Week',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkbox-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  )
}
