import { View } from 'react-native'
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated'
import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg'
import { useTheme } from '@/theme/ThemeProvider'

export const PIP_WIDTH = 64
export const PIP_HEIGHT = 68
/** Distance from Pip's top edge to the soles of the feet. */
export const PIP_FEET_Y = 67.4

const PUPIL = '#13201A'
const SHOULDER_Y = 31

type PipProps = {
  /** 0 = eyes open, 1 = the happy "^ ^" squint (the logo chevron, twice). */
  joy?: SharedValue<number>
  /** 0 = arms tucked, 1 = arms thrown up. */
  raise?: SharedValue<number>
  /** Scarf-tail angle in degrees; negative hangs down, positive lifts. */
  sway?: SharedValue<number>
}

/**
 * Pip — the Elevate logo tile come to life. A brand-green tile with a coral scarf;
 * when happy, its eyes become the logo's chevron. Every colour comes from the theme,
 * so Pip flips with light and dark mode the same way the logo does.
 */
export function Pip({ joy, raise, sway }: PipProps) {
  const { colors } = useTheme()

  const openEyes = useAnimatedStyle(() => {
    const open = 1 - (joy ? joy.value : 0)
    return { opacity: open < 0.35 ? 0 : 1, transform: [{ scaleY: Math.max(0.1, open) }] }
  })
  const happyEyes = useAnimatedStyle(() => {
    const j = joy ? joy.value : 0
    return { opacity: j < 0.35 ? 0 : Math.min(1, (j - 0.35) * 3) }
  })
  const leftArm = useAnimatedStyle(() => {
    const r = raise ? raise.value : 0
    return { transform: [{ rotate: `${-80 + 120 * r}deg` }] }
  })
  const rightArm = useAnimatedStyle(() => {
    const r = raise ? raise.value : 0
    return { transform: [{ rotate: `${80 - 120 * r}deg` }] }
  })
  const tails = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sway ? sway.value : -20}deg` }],
  }))

  return (
    <View style={{ width: PIP_WIDTH, height: PIP_HEIGHT }}>
      {/* Behind the body: scarf tails and arms pivot from points hidden under the tile. */}
      <Animated.View
        style={[
          { position: 'absolute', left: -8, top: 32, width: 20, height: 23 },
          { transformOrigin: '18px 8px' },
          tails,
        ]}
      >
        <Svg width={20} height={23} viewBox="0 0 20 23">
          <Path
            d="M18 6.5 C12 5 6 5.5 1.5 7.5 L5 10 L2 13 C7 11.5 12 10.5 18 9.5 Z"
            fill={colors.accent}
          />
          <Path
            d="M18 9 C14 12 10 15.5 7 19.5 L10.5 19 L11 22 C13.5 18 16 14 18.5 11 Z"
            fill={colors.accentHover}
          />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[
          { position: 'absolute', left: -3, top: SHOULDER_Y - 2, width: 14, height: 4 },
          { transformOrigin: '13px 2px' },
          leftArm,
        ]}
      >
        <Svg width={14} height={4}>
          <Line
            x1={13}
            y1={2}
            x2={3}
            y2={2}
            stroke={colors.ink}
            strokeWidth={2.6}
            strokeLinecap="round"
          />
          <Circle cx={2.4} cy={2} r={1.9} fill={colors.ink} />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[
          { position: 'absolute', left: 53, top: SHOULDER_Y - 2, width: 14, height: 4 },
          { transformOrigin: '1px 2px' },
          rightArm,
        ]}
      >
        <Svg width={14} height={4}>
          <Line
            x1={1}
            y1={2}
            x2={11}
            y2={2}
            stroke={colors.ink}
            strokeWidth={2.6}
            strokeLinecap="round"
          />
          <Circle cx={11.6} cy={2} r={1.9} fill={colors.ink} />
        </Svg>
      </Animated.View>

      <Svg
        width={PIP_WIDTH}
        height={PIP_HEIGHT}
        viewBox={`0 0 ${PIP_WIDTH} ${PIP_HEIGHT}`}
        style={{ position: 'absolute', left: 0, top: 0 }}
      >
        {/* Legs and feet in ink, like a pen line on paper. */}
        <Line
          x1={27}
          y1={50}
          x2={27}
          y2={62}
          stroke={colors.ink}
          strokeWidth={2.6}
          strokeLinecap="round"
        />
        <Line
          x1={37}
          y1={50}
          x2={37}
          y2={62}
          stroke={colors.ink}
          strokeWidth={2.6}
          strokeLinecap="round"
        />
        <Ellipse cx={28.6} cy={64.6} rx={4.6} ry={2.8} fill={colors.ink} />
        <Ellipse cx={38.6} cy={64.6} rx={4.6} ry={2.8} fill={colors.ink} />

        {/* The tile: same proportions and colour as the Elevate mark. */}
        <Rect x={8} y={4} width={48} height={48} rx={12} fill={colors.brand} />
        <Rect x={8} y={37} width={48} height={6} fill={colors.accent} />
        <Circle cx={10.5} cy={40} r={3.6} fill={colors.accentHover} />

        <Circle cx={18.5} cy={30} r={2.8} fill={colors.accent} />
        <Circle cx={45.5} cy={30} r={2.8} fill={colors.accent} />
        <Path
          d="M28.5 29.5 Q32 33 35.5 29.5"
          stroke={colors.brandInk}
          strokeWidth={2.2}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>

      {/* Open eyes, glancing up the trail. */}
      <Animated.View
        style={[{ position: 'absolute', left: 18, top: 15, width: 28, height: 14 }, openEyes]}
      >
        <Svg width={28} height={14}>
          <Ellipse cx={7} cy={7} rx={4.6} ry={5.4} fill="#FFFFFF" />
          <Ellipse cx={21} cy={7} rx={4.6} ry={5.4} fill="#FFFFFF" />
          <Circle cx={8.3} cy={6} r={2.6} fill={PUPIL} />
          <Circle cx={22.3} cy={6} r={2.6} fill={PUPIL} />
          <Circle cx={9.2} cy={4.9} r={0.95} fill="#FFFFFF" />
          <Circle cx={23.2} cy={4.9} r={0.95} fill="#FFFFFF" />
        </Svg>
      </Animated.View>
      {/* Happy eyes: two copies of the logo's chevron. */}
      <Animated.View
        style={[{ position: 'absolute', left: 18, top: 15, width: 28, height: 14 }, happyEyes]}
      >
        <Svg width={28} height={14}>
          <Path
            d="M3 9 L7 5 L11 9 M17 9 L21 5 L25 9"
            stroke={colors.brandInk}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  )
}
