import {
  Award,
  Camera,
  Check,
  ChefHat,
  type LucideIcon,
  Music,
  Palette,
  Play,
} from 'lucide-react-native'
import { useEffect, useId, useState } from 'react'
import { type StyleProp, View, type ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Defs, Line, LinearGradient, Rect, Stop } from 'react-native-svg'
import { useTheme } from '@/theme/ThemeProvider'
import { PIP_FEET_Y, PIP_HEIGHT, PIP_WIDTH, Pip } from './Pip'

/*
 * Pip climbs a course trail: the same ascending path of lesson nodes the app draws on
 * course pages. Each hop lands on the "in progress" node and completes it; every third
 * node is a milestone (award) where Pip celebrates. The camera follows Pip, so the
 * trail slides down-left and recycles a fixed set of SLOTS node views.
 *
 * Clock: `t` runs 0 → LOOP, one unit per hop. Node n is a milestone when n mod 3 = 2,
 * and slot j always holds nodes n ≡ j (mod SLOTS). LOOP is a multiple of SLOTS and 3,
 * so wrapping from LOOP back to 0 is seamless.
 */

/** Design size of the stage; it scales down uniformly to fit narrower heroes. */
const STAGE_W = 440
const STAGE_H = 300

const LOOP = 6
const SLOTS = 6
const BEHIND = 2
const HOP_MS = 1500

/** Trail geometry: Pip's node centre, the step between nodes, node radius. */
const BX = 200
const BY = 182
const DX = 84
const DY = 46
const R = 16
const SEG_LEN = Math.hypot(DX, DY)
const SEG_ANGLE = (Math.atan2(-DY, DX) * 180) / Math.PI
const ARC = 40

/** One hop, as fractions of a beat. */
const CROUCH_END = 0.14
const LAND = 0.6
const SETTLE = 0.76

function clamp01(x: number) {
  'worklet'
  return Math.min(1, Math.max(0, x))
}

function smooth(x: number) {
  'worklet'
  const c = clamp01(x)
  return c * c * (3 - 2 * c)
}

function backOut(x: number) {
  'worklet'
  const c1 = 1.70158
  const u = x - 1
  return 1 + (c1 + 1) * u * u * u + c1 * u * u
}

function mod(a: number, n: number) {
  'worklet'
  return ((a % n) + n) % n
}

/** Where the clock is within the current hop. `a` is airborne progress, or -1 on the ground. */
function beat(t: number) {
  'worklet'
  const m = Math.floor(t)
  const p = t - m
  const a = p < CROUCH_END || p > LAND ? -1 : (p - CROUCH_END) / (LAND - CROUCH_END)
  const s = m + (p < CROUCH_END ? 0 : p > LAND ? 1 : smooth(a))
  return { m, p, a, s }
}

/** The world node index slot `j` shows while Pip is on (or leaving) node `m`. */
function nodeFor(j: number, m: number) {
  'worklet'
  return m - BEHIND + mod(j - (m - BEHIND), SLOTS)
}

/** Nodes fade in at the top of the trail and out at the bottom. */
function appear(rel: number) {
  'worklet'
  if (rel > 2) return clamp01(3 - rel)
  if (rel < -2) return clamp01(rel + 3)
  return 1
}

function landsOnMilestone(m: number) {
  'worklet'
  return mod(m + 1, 3) === 2
}

export function HeroScene({ style }: { style?: StyleProp<ViewStyle> }) {
  const [scale, setScale] = useState(0)
  return (
    <View
      accessible={false}
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => setScale(e.nativeEvent.layout.width / STAGE_W)}
      style={[
        { width: '100%', maxWidth: STAGE_W, aspectRatio: STAGE_W / STAGE_H, pointerEvents: 'none' },
        style,
      ]}
    >
      {scale > 0 ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: STAGE_W,
            height: STAGE_H,
            transformOrigin: 'top left',
            transform: [{ scale }],
          }}
        >
          <Stage />
        </View>
      ) : null}
    </View>
  )
}

function Stage() {
  const { colors, scheme } = useTheme()
  const reduceMotion = useReducedMotion()
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const t = useSharedValue(0)

  useEffect(() => {
    if (reduceMotion) return
    t.value = withRepeat(
      withTiming(LOOP, { duration: LOOP * HOP_MS, easing: Easing.linear }),
      -1,
      false,
    )
    return () => cancelAnimation(t)
  }, [reduceMotion, t])

  const joy = useDerivedValue(() => {
    const { m, p } = beat(t.value)
    if (p < LAND) return 0
    const x = p - LAND
    if (landsOnMilestone(m)) return smooth(x / 0.05) * (1 - smooth((x - 0.3) / 0.06))
    return smooth(x / 0.03) * (1 - smooth((x - 0.11) / 0.04))
  })

  const raise = useDerivedValue(() => {
    const { m, p, a } = beat(t.value)
    if (a >= 0) return 0.7 * Math.sin(Math.PI * Math.min(1, a * 1.25))
    if (p > LAND && landsOnMilestone(m)) return Math.sin(Math.PI * Math.min(1, (p - LAND) / 0.36))
    return 0
  })

  const sway = useDerivedValue(() => {
    const { p, a } = beat(t.value)
    const flutter = 3 * Math.sin(t.value * Math.PI * 4)
    // Tails drag down on take-off, lift on the way down, then wobble to rest.
    if (a >= 0) return (a < 0.5 ? -20 - 36 * a : -38 + 112 * (a - 0.5)) + flutter
    const since = p > LAND ? p - LAND : p + 1 - LAND
    return -20 + 38 * Math.exp(-since * 7) * Math.cos(since * 30) + flutter
  })

  const pipStyle = useAnimatedStyle(() => {
    const { p, a } = beat(t.value)
    let y = 0
    let sx = 1
    let sy = 1
    let rot = 0
    if (p < CROUCH_END) {
      const c = Math.sin((p / CROUCH_END) * (Math.PI / 2))
      sx = 1 + 0.12 * c
      sy = 1 - 0.14 * c
    } else if (a >= 0) {
      y = -ARC * 4 * a * (1 - a)
      const stretch = Math.max(0, 1 - a * 2.2)
      sx = 1 - 0.08 * stretch
      sy = 1 + 0.12 * stretch
      rot = 7 * Math.sin(Math.PI * a)
    } else if (p < SETTLE) {
      const s = Math.sin(((p - LAND) / (SETTLE - LAND)) * Math.PI)
      sx = 1 + 0.12 * s
      sy = 1 - 0.12 * s
    }
    return {
      transform: [{ translateY: y }, { rotate: `${rot}deg` }, { scaleX: sx }, { scaleY: sy }],
    }
  })

  const sunStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.03 * Math.sin((t.value / 3) * Math.PI * 2) }],
  }))

  const rippleStyle = useAnimatedStyle(() => {
    const { p } = beat(t.value)
    const x = p > LAND ? Math.min(1, (p - LAND) / 0.32) : 1
    return { opacity: 0.55 * (1 - x), transform: [{ scale: 1 + 1.2 * x }] }
  })

  const burstStyle = useAnimatedStyle(() => {
    const { m, p } = beat(t.value)
    const on = p > LAND && landsOnMilestone(m)
    const x = on ? Math.min(1, (p - LAND) / 0.36) : 1
    return {
      opacity: on ? 1 - x * x : 0,
      transform: [{ scale: 0.7 + 1.1 * (1 - (1 - x) * (1 - x)) }, { rotate: `${x * 18}deg` }],
    }
  })

  return (
    <View style={{ width: STAGE_W, height: STAGE_H }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 372 - 60,
            top: 76 - 60,
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: colors.accentTint,
            opacity: scheme === 'dark' ? 0.7 : 1,
          },
          sunStyle,
        ]}
      />

      <CraftChip t={t} x={58} y={76} phase={0} icon={Camera} />
      <CraftChip t={t} x={122} y={132} phase={0.35} icon={Palette} />
      <CraftChip t={t} x={308} y={244} phase={0.6} icon={Music} />
      <CraftChip t={t} x={402} y={188} phase={0.15} icon={ChefHat} />

      {SLOT_IDS.map((j) => (
        <TrailSegment key={j} t={t} slot={j} gradientId={`${uid}s${j}`} />
      ))}

      <Animated.View
        style={[
          {
            position: 'absolute',
            left: BX - R,
            top: BY - R,
            width: R * 2,
            height: R * 2,
            borderRadius: R,
            borderWidth: 2,
            borderColor: colors.brand,
          },
          rippleStyle,
        ]}
      />

      {SLOT_IDS.map((j) => (
        <TrailNode key={j} t={t} slot={j} milestone={j % 3 === 2} />
      ))}

      <Animated.View
        style={[
          { position: 'absolute', left: BX - 50, top: BY - 50, width: 100, height: 100 },
          burstStyle,
        ]}
      >
        <Svg width={100} height={100}>
          {BURST_RAYS.map((deg, i) => {
            const rad = (deg * Math.PI) / 180
            return (
              <Line
                key={deg}
                x1={50 + Math.cos(rad) * 21}
                y1={50 + Math.sin(rad) * 21}
                x2={50 + Math.cos(rad) * 27}
                y2={50 + Math.sin(rad) * 27}
                stroke={i % 2 === 0 ? colors.accent : colors.brand}
                strokeWidth={2.4}
                strokeLinecap="round"
              />
            )
          })}
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          {
            position: 'absolute',
            left: BX - PIP_WIDTH / 2,
            top: BY - R - PIP_FEET_Y + 0.6,
            width: PIP_WIDTH,
            height: PIP_HEIGHT,
            transformOrigin: 'bottom',
          },
          pipStyle,
        ]}
      >
        <Pip joy={joy} raise={raise} sway={sway} />
      </Animated.View>
    </View>
  )
}

const SLOT_IDS = Array.from({ length: SLOTS }, (_, j) => j)
const BURST_RAYS = [0, 45, 90, 135, 180, 225, 270, 315]

/** A lesson node in the same four-state style as the course Trail. */
function TrailNode({
  t,
  slot,
  milestone,
}: {
  t: SharedValue<number>
  slot: number
  milestone: boolean
}) {
  const { colors } = useTheme()

  const position = useAnimatedStyle(() => {
    const { m, p, s } = beat(t.value)
    const n = nodeFor(slot, m)
    const rel = n - s
    const o = appear(rel)
    let pulse = 1
    let dip = 0
    if (n === m + 1 && p > LAND) {
      const k = Math.sin(Math.PI * Math.min(1, (p - LAND) / 0.22))
      pulse = 1 + 0.14 * k
      dip = 3 * k
    }
    return {
      opacity: o,
      transform: [
        { translateX: rel * DX },
        { translateY: -rel * DY + dip },
        { scale: (0.7 + 0.3 * o) * pulse },
      ],
    }
  })

  // "In progress": the node Pip is heading for. The next one lights up once Pip lands.
  const activeStyle = useAnimatedStyle(() => {
    const { m, p } = beat(t.value)
    const n = nodeFor(slot, m)
    const v = n <= m + 1 ? 1 : n === m + 2 && p > LAND ? smooth((p - LAND - 0.04) / 0.2) : 0
    return { opacity: v, transform: [{ scale: 0.5 + 0.5 * v }] }
  })

  // "Completed": pops in as Pip's feet touch down.
  const doneStyle = useAnimatedStyle(() => {
    const { m, p } = beat(t.value)
    const n = nodeFor(slot, m)
    const v = n <= m ? 1 : n === m + 1 && p > LAND ? Math.min(1, (p - LAND) / 0.2) : 0
    return { opacity: Math.min(1, v * 4), transform: [{ scale: 0.5 + 0.5 * backOut(v) }] }
  })

  const layer = {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    width: R * 2,
    height: R * 2,
    borderRadius: R,
    borderWidth: 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  }

  return (
    <Animated.View
      style={[
        { position: 'absolute', left: BX - R, top: BY - R, width: R * 2, height: R * 2 },
        position,
      ]}
    >
      {milestone ? (
        <View
          style={{
            position: 'absolute',
            left: -5,
            top: -5,
            width: R * 2 + 10,
            height: R * 2 + 10,
            borderRadius: R + 5,
            borderWidth: 1.5,
            borderColor: colors.brand,
            opacity: 0.35,
          }}
        />
      ) : null}
      <View style={[layer, { backgroundColor: colors.surface, borderColor: colors.brand }]}>
        {milestone ? <Award size={16} color={colors.brand} strokeWidth={2.25} /> : null}
      </View>
      <Animated.View
        style={[layer, { backgroundColor: colors.accent, borderColor: colors.accent }, activeStyle]}
      >
        {milestone ? (
          <Award size={16} color={colors.accentInk} strokeWidth={2.25} />
        ) : (
          <Play size={13} color={colors.accentInk} fill={colors.accentInk} />
        )}
      </Animated.View>
      <Animated.View
        style={[layer, { backgroundColor: colors.brand, borderColor: colors.brand }, doneStyle]}
      >
        {milestone ? (
          <Award size={16} color={colors.brandInk} strokeWidth={2.25} />
        ) : (
          <Check size={16} color={colors.brandInk} strokeWidth={3} />
        )}
      </Animated.View>
    </Animated.View>
  )
}

/**
 * The 2px connector from a slot's node to the next one. It fills with brand colour
 * as Pip travels along it, and fades out (ahead) or in (behind) at the trail's ends.
 */
function TrailSegment({
  t,
  slot,
  gradientId,
}: {
  t: SharedValue<number>
  slot: number
  gradientId: string
}) {
  const { colors } = useTheme()

  const position = useAnimatedStyle(() => {
    const { m, s } = beat(t.value)
    const rel = nodeFor(slot, m) - s
    return {
      transform: [
        { translateX: rel * DX },
        { translateY: -rel * DY },
        { rotate: `${SEG_ANGLE}deg` },
      ],
    }
  })
  const solidStyle = useAnimatedStyle(() => {
    const { m, s } = beat(t.value)
    const rel = nodeFor(slot, m) - s
    return { opacity: Math.min(appear(rel), appear(rel + 1)) }
  })
  const fillStyle = useAnimatedStyle(() => {
    const { m, s } = beat(t.value)
    return { transform: [{ scaleX: clamp01(s - nodeFor(slot, m)) }] }
  })
  const aheadStyle = useAnimatedStyle(() => {
    const { m, s } = beat(t.value)
    const rel = nodeFor(slot, m) - s
    return { opacity: appear(rel) * (1 - appear(rel + 1)) }
  })
  const behindStyle = useAnimatedStyle(() => {
    const { m, s } = beat(t.value)
    const rel = nodeFor(slot, m) - s
    return { opacity: (1 - appear(rel)) * appear(rel + 1) }
  })

  const line = { position: 'absolute' as const, left: 0, top: 0, width: SEG_LEN, height: 2 }

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: BX,
          top: BY - 1,
          width: SEG_LEN,
          height: 2,
          transformOrigin: '0px 1px',
        },
        position,
      ]}
    >
      <Animated.View style={[line, solidStyle]}>
        <View style={[line, { backgroundColor: colors.borderStrong, borderRadius: 1 }]} />
        <Animated.View
          style={[
            line,
            { backgroundColor: colors.brand, borderRadius: 1, transformOrigin: '0px 1px' },
            fillStyle,
          ]}
        />
      </Animated.View>
      <Animated.View style={[line, aheadStyle]}>
        <Svg width={SEG_LEN} height={2}>
          <Defs>
            <LinearGradient id={`${gradientId}a`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.borderStrong} stopOpacity={1} />
              <Stop offset="1" stopColor={colors.borderStrong} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={SEG_LEN} height={2} fill={`url(#${gradientId}a)`} />
        </Svg>
      </Animated.View>
      <Animated.View style={[line, behindStyle]}>
        <Svg width={SEG_LEN} height={2}>
          <Defs>
            <LinearGradient id={`${gradientId}b`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.brand} stopOpacity={0} />
              <Stop offset="1" stopColor={colors.brand} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={SEG_LEN} height={2} fill={`url(#${gradientId}b)`} />
        </Svg>
      </Animated.View>
    </Animated.View>
  )
}

/** A craft from the catalogue, bobbing gently around the trail. */
function CraftChip({
  t,
  x,
  y,
  phase,
  icon: Icon,
}: {
  t: SharedValue<number>
  x: number
  y: number
  phase: number
  icon: LucideIcon
}) {
  const { colors } = useTheme()
  const style = useAnimatedStyle(() => {
    const u = (t.value / 3 + phase) * Math.PI * 2
    return { transform: [{ translateY: 5 * Math.sin(u) }, { rotate: `${4 * Math.cos(u)}deg` }] }
  })
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x - 17,
          top: y - 17,
          width: 34,
          height: 34,
          borderRadius: 17,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Icon size={16} color={colors.inkSecondary} strokeWidth={2} />
    </Animated.View>
  )
}
