import type { LucideIcon } from 'lucide-react-native'
import { View } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'
import { Button, type ButtonProps } from './Button'
import { Text } from './Text'

export type EmptyStateProps = {
  icon?: LucideIcon
  eyebrow?: string
  title: string
  body?: string
  action?: Pick<ButtonProps, 'label' | 'onPress' | 'variant'>
  tone?: 'neutral' | 'danger'
}

export function EmptyState({
  icon: Icon,
  eyebrow,
  title,
  body,
  action,
  tone = 'neutral',
}: EmptyStateProps) {
  const theme = useTheme()
  return (
    <View
      style={{
        alignItems: 'center',
        padding: theme.space[8],
        gap: theme.space[3],
        borderRadius: theme.radii.card,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: tone === 'danger' ? theme.colors.danger : theme.colors.borderStrong,
        backgroundColor: theme.colors.surfaceMuted,
      }}
    >
      {Icon ? (
        <Icon
          size={28}
          color={tone === 'danger' ? theme.colors.danger : theme.colors.brand}
          strokeWidth={1.8}
        />
      ) : null}
      {eyebrow ? (
        <Text variant="eyebrow" tone="tertiary">
          {eyebrow}
        </Text>
      ) : null}
      <Text variant="h3" align="center">
        {title}
      </Text>
      {body ? (
        <Text tone="secondary" align="center" style={{ maxWidth: 420 }}>
          {body}
        </Text>
      ) : null}
      {action ? (
        <Button
          variant={action.variant ?? 'secondary'}
          label={action.label}
          onPress={action.onPress}
        />
      ) : null}
    </View>
  )
}
