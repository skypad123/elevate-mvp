/**
 * Elevate design tokens — direction "Atelier": warm, editorial, trustworthy.
 * One token set feeds three surfaces: the React Native learner app (imports this
 * module directly) and the two Vite portals (consume the generated CSS in dist/).
 */

export const colorScales = {
  light: {
    canvas: '#FAF7F1',
    surface: '#FFFFFF',
    surfaceMuted: '#F2EDE4',
    surfaceSunken: '#EFE9DF',
    border: '#E5DED2',
    borderStrong: '#D3C9B8',
    ink: '#1A1C1A',
    inkSecondary: '#575B57',
    inkTertiary: '#8A8E89',
    inkInverse: '#F3F0E8',
    brand: '#0F6B52',
    brandHover: '#0B5742',
    brandTint: '#E1F1EA',
    brandInk: '#FFFFFF',
    brandFg: '#0F6B52',
    accent: '#B84024',
    accentHover: '#A83A20',
    accentTint: '#FDE8E0',
    accentInk: '#FFFFFF',
    success: '#1F7A4D',
    successTint: '#E3F3EA',
    warning: '#B4781B',
    warningTint: '#FBF1DC',
    danger: '#B42318',
    dangerTint: '#FBE4E1',
    info: '#2F5FD6',
    infoTint: '#E4EBFB',
    overlay: 'rgba(26, 28, 26, 0.48)',
    focus: '#0F6B52',
  },
  dark: {
    canvas: '#111312',
    surface: '#191C1A',
    surfaceMuted: '#20241F',
    surfaceSunken: '#0C0E0D',
    border: '#2C312C',
    borderStrong: '#3A403A',
    ink: '#F3F0E8',
    inkSecondary: '#B5B8B1',
    inkTertiary: '#7F837D',
    inkInverse: '#1A1C1A',
    brand: '#4CB58F',
    brandHover: '#63C49F',
    brandTint: '#17322A',
    brandInk: '#0E1A15',
    brandFg: '#4CB58F',
    accent: '#FF7F5E',
    accentHover: '#FF9377',
    accentTint: '#3A1F18',
    accentInk: '#1A0F0B',
    success: '#4CB58F',
    successTint: '#17322A',
    warning: '#D9A23F',
    warningTint: '#33280F',
    danger: '#F0705F',
    dangerTint: '#3A1A17',
    info: '#7BA2F5',
    infoTint: '#192540',
    overlay: 'rgba(0, 0, 0, 0.6)',
    focus: '#4CB58F',
  },
} as const

export type ColorScheme = keyof typeof colorScales
export type ColorToken = keyof (typeof colorScales)['light']
/** A full set of colour tokens (any hex/rgba strings, not the Atelier literals). */
export type ColorScale = Record<ColorToken, string>

/**
 * Colour roles, for reference when adding tokens or palettes:
 * - `brand` / `brandHover` / `brandInk`: filled controls (buttons, logo square) and the text on them.
 * - `brandFg`: brand used as a foreground — text, icons, links on `surface`/`canvas`/`brandTint`.
 *   Equal to `brand` in Atelier; split so a palette whose fill is too light for text (Support's
 *   yellow) can still pass contrast. Use `text-brand-fg`, never `text-brand`, for text.
 * - `focus`: focus rings; must reach 3:1 against `canvas`.
 */

export type PortalId = 'teach' | 'support'

/**
 * Per-portal palette overrides, layered on top of `colorScales` by the generated
 * `dist/portal-<id>.css` files. The learner app imports `colorScales` directly and keeps Atelier.
 * Only list the tokens that differ; both schemes should override the same keys.
 */
export const portalPalettes = {
  /** Light blue. */
  teach: {
    light: {
      canvas: '#F5F8FB',
      surface: '#FFFFFF',
      surfaceMuted: '#EAF1F8',
      surfaceSunken: '#E1EAF3',
      border: '#D6E1EB',
      borderStrong: '#BBCDDC',
      ink: '#141A20',
      inkSecondary: '#4F5B66',
      inkTertiary: '#7F8B96',
      inkInverse: '#EEF4F9',
      brand: '#1F6FB2',
      brandHover: '#185B93',
      brandTint: '#E3F0FB',
      brandInk: '#FFFFFF',
      brandFg: '#1F6FB2',
      focus: '#1F6FB2',
    },
    dark: {
      canvas: '#0E1419',
      surface: '#151C23',
      surfaceMuted: '#1B242D',
      surfaceSunken: '#090D11',
      border: '#273340',
      borderStrong: '#354453',
      ink: '#EEF4F9',
      inkSecondary: '#AEBAC6',
      inkTertiary: '#7C8894',
      inkInverse: '#141A20',
      brand: '#6DB3F2',
      brandHover: '#8AC3F6',
      brandTint: '#14304A',
      brandInk: '#0B1A2B',
      brandFg: '#8AC3F6',
      focus: '#6DB3F2',
    },
  },
  /** Yellow. The fill is true yellow with dark text on it; foreground brand is a dark amber. */
  support: {
    light: {
      canvas: '#FDFBF3',
      surface: '#FFFFFF',
      surfaceMuted: '#F6F1DF',
      surfaceSunken: '#F0EAD3',
      border: '#E8E0C4',
      borderStrong: '#D6CBA3',
      brand: '#F5C400',
      brandHover: '#E0B300',
      brandTint: '#FFF4C2',
      brandInk: '#1F1A00',
      brandFg: '#8A6200',
      focus: '#8A6200',
      warning: '#B45309',
      warningTint: '#FCEBDD',
    },
    dark: {
      canvas: '#121210',
      surface: '#1B1A16',
      surfaceMuted: '#23211B',
      surfaceSunken: '#0C0C0A',
      border: '#302E26',
      borderStrong: '#3F3C31',
      brand: '#F6CB3C',
      brandHover: '#F8D563',
      brandTint: '#3A2E08',
      brandInk: '#1F1A00',
      brandFg: '#F6CB3C',
      focus: '#F6CB3C',
      warning: '#F0A868',
      warningTint: '#3A2410',
    },
  },
} as const satisfies Record<PortalId, Record<ColorScheme, Partial<ColorScale>>>

/** 4px-based spacing scale. Keys are multiples of 4 (so `space[4]` is 16px). */
export const space = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const

export const radii = {
  sm: 6,
  control: 10,
  card: 16,
  lg: 20,
  pill: 999,
} as const

/**
 * Font family names. On web these map to Google Fonts; on native, the learner app
 * registers TTFs under the "<family>-<weight>" names listed in fontFaces.
 */
export const fontFamilies = {
  display: 'Fraunces',
  text: 'Inter',
  mono: 'JetBrains Mono',
} as const

export const fontFaces = {
  display: {
    regular: 'Fraunces-Regular',
    semibold: 'Fraunces-SemiBold',
    italic: 'Fraunces-Italic',
  },
  text: {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semibold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
  },
  mono: { medium: 'JetBrainsMono-Medium' },
} as const

export const fontStacks = {
  display: '"Fraunces", "Iowan Old Style", Georgia, serif',
  text: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const

export type TypeStyle = {
  size: number
  lineHeight: number
  weight: 400 | 500 | 600 | 700
  family: keyof typeof fontFamilies
  letterSpacing?: number
  uppercase?: boolean
}

export const typeScale = {
  display: { size: 44, lineHeight: 48, weight: 600, family: 'display' },
  h1: { size: 32, lineHeight: 38, weight: 600, family: 'display' },
  h2: { size: 24, lineHeight: 30, weight: 600, family: 'display' },
  h3: { size: 19, lineHeight: 26, weight: 600, family: 'text' },
  bodyLg: { size: 18, lineHeight: 28, weight: 400, family: 'text' },
  body: { size: 16, lineHeight: 24, weight: 400, family: 'text' },
  bodyStrong: { size: 16, lineHeight: 24, weight: 600, family: 'text' },
  small: { size: 14, lineHeight: 20, weight: 400, family: 'text' },
  smallStrong: { size: 14, lineHeight: 20, weight: 600, family: 'text' },
  caption: { size: 12, lineHeight: 16, weight: 500, family: 'text' },
  eyebrow: {
    size: 11,
    lineHeight: 16,
    weight: 500,
    family: 'mono',
    letterSpacing: 0.08,
    uppercase: true,
  },
  price: { size: 20, lineHeight: 24, weight: 500, family: 'mono' },
} as const satisfies Record<string, TypeStyle>

export type TypeScaleKey = keyof typeof typeScale

export const shadows = {
  /** The single soft shadow used for floating chrome (tab bar, dialogs, popovers). */
  float: {
    css: '0 8px 24px rgba(26, 28, 26, 0.08)',
    native: {
      shadowColor: '#1A1C1A',
      shadowOpacity: 0.08,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
  },
} as const

export const breakpoints = {
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const

export const motion = {
  duration: { fast: 160, base: 200, slow: 240 },
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
  /** Content enters by fading in while rising this many px. */
  rise: 8,
} as const

export const layout = {
  contentMaxWidth: 1200,
  readingMaxWidth: 720,
  sidebarWidth: 248,
} as const

export const tokens = {
  colorScales,
  space,
  radii,
  fontFamilies,
  fontFaces,
  fontStacks,
  typeScale,
  shadows,
  breakpoints,
  motion,
  layout,
} as const

export type Tokens = typeof tokens
