import {
  breakpoints,
  type ColorScheme,
  type ColorToken,
  colorScales,
  fontFaces,
  layout,
  motion,
  radii,
  shadows,
  space,
  type TypeScaleKey,
  typeScale,
} from '@elevate/tokens'
import type { TextStyle } from 'react-native'

export type ThemeColors = Record<ColorToken, string>

export type Theme = {
  scheme: ColorScheme
  colors: ThemeColors
  space: typeof space
  radii: typeof radii
  text: Record<TypeScaleKey, TextStyle>
  shadow: typeof shadows.float.native
  breakpoints: typeof breakpoints
  layout: typeof layout
  motion: typeof motion
}

function fontFamilyFor(family: 'display' | 'text' | 'mono', weight: number): string {
  if (family === 'display')
    return weight >= 600 ? fontFaces.display.semibold : fontFaces.display.regular
  if (family === 'mono') return fontFaces.mono.medium
  if (weight >= 700) return fontFaces.text.bold
  if (weight >= 600) return fontFaces.text.semibold
  if (weight >= 500) return fontFaces.text.medium
  return fontFaces.text.regular
}

/** RN 0.87+ types style props as readonly; use this when building a style up field by field. */
export type MutableTextStyle = { -readonly [K in keyof TextStyle]: TextStyle[K] }

function buildTextStyles(colors: ThemeColors): Record<TypeScaleKey, TextStyle> {
  const entries = Object.entries(typeScale).map(([key, style]) => {
    const text: MutableTextStyle = {
      fontFamily: fontFamilyFor(style.family, style.weight),
      fontSize: style.size,
      lineHeight: style.lineHeight,
      color: colors.ink,
    }
    if ('letterSpacing' in style && style.letterSpacing)
      text.letterSpacing = style.size * style.letterSpacing
    if ('uppercase' in style && style.uppercase) text.textTransform = 'uppercase'
    return [key, text]
  })
  return Object.fromEntries(entries) as Record<TypeScaleKey, TextStyle>
}

export function buildTheme(scheme: ColorScheme): Theme {
  const colors: ThemeColors = colorScales[scheme]
  return {
    scheme,
    colors,
    space,
    radii,
    text: buildTextStyles(colors),
    shadow: shadows.float.native,
    breakpoints,
    layout,
    motion,
  }
}

export { breakpoints, radii, space }
