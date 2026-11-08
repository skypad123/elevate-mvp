import type { LucideIcon } from 'lucide-react-native'
import { Pressable, type PressableProps } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'

export type IconButtonProps = Omit<PressableProps, 'style'> & {
  icon: LucideIcon
  label: string
  size?: number
  tone?: 'default' | 'brand' | 'inverse'
  filled?: boolean
}

export function IconButton({
  icon: Icon,
  label,
  size = 40,
  tone = 'default',
  filled,
  ...rest
}: IconButtonProps) {
  const { colors, radii } = useTheme()
  const color =
    tone === 'brand' ? colors.brand : tone === 'inverse' ? colors.inkInverse : colors.ink
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      {...rest}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: filled ? colors.surfaceMuted : 'transparent',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon size={Math.round(size * 0.5)} color={color} strokeWidth={2} />
    </Pressable>
  )
}
