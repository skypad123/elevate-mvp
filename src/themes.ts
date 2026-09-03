import { createV5Theme, defaultChildrenThemes } from '@tamagui/config/v5'
import { v5ComponentThemes } from '@tamagui/themes/v5'
import { yellow, yellowDark, red, redDark, green, greenDark } from '@tamagui/colors'

const darkPalette = ['hsla(220, 16%, 11%, 1)','hsla(220, 16%, 15%, 1)','hsla(220, 16%, 20%, 1)','hsla(220, 16%, 24%, 1)','hsla(220, 16%, 28%, 1)','hsla(220, 16%, 33%, 1)','hsla(220, 16%, 37%, 1)','hsla(220, 16%, 41%, 1)','hsla(220, 16%, 46%, 1)','hsla(220, 16%, 50%, 1)','hsla(0, 15%, 93%, 1)','hsla(0, 15%, 99%, 1)']
const lightPalette = ['hsla(220, 16%, 99%, 1)','hsla(220, 16%, 94%, 1)','hsla(220, 16%, 88%, 1)','hsla(220, 16%, 83%, 1)','hsla(220, 16%, 77%, 1)','hsla(220, 16%, 72%, 1)','hsla(220, 16%, 66%, 1)','hsla(220, 16%, 61%, 1)','hsla(220, 16%, 55%, 1)','hsla(220, 16%, 50%, 1)','hsla(0, 15%, 15%, 1)','hsla(0, 15%, 1%, 1)']

// Your custom accent color theme
const accentLight = {
  "accent1": "hsla(170, 50%, 40%, 1)",
  "accent2": "hsla(170, 50%, 43%, 1)",
  "accent3": "hsla(170, 50%, 46%, 1)",
  "accent4": "hsla(170, 50%, 48%, 1)",
  "accent5": "hsla(170, 50%, 51%, 1)",
  "accent6": "hsla(170, 50%, 54%, 1)",
  "accent7": "hsla(170, 50%, 57%, 1)",
  "accent8": "hsla(170, 50%, 59%, 1)",
  "accent9": "hsla(170, 50%, 62%, 1)",
  "accent10": "hsla(170, 50%, 65%, 1)",
  "accent11": "hsla(250, 50%, 95%, 1)",
  "accent12": "hsla(250, 50%, 95%, 1)"
}

const accentDark = {
  "accent1": "hsla(170, 50%, 38%, 1)",
  "accent2": "hsla(170, 50%, 40%, 1)",
  "accent3": "hsla(170, 50%, 43%, 1)",
  "accent4": "hsla(170, 50%, 45%, 1)",
  "accent5": "hsla(170, 50%, 48%, 1)",
  "accent6": "hsla(170, 50%, 50%, 1)",
  "accent7": "hsla(170, 50%, 53%, 1)",
  "accent8": "hsla(170, 50%, 55%, 1)",
  "accent9": "hsla(170, 50%, 58%, 1)",
  "accent10": "hsla(170, 50%, 60%, 1)",
  "accent11": "hsla(250, 50%, 90%, 1)",
  "accent12": "hsla(250, 50%, 95%, 1)"
}

const builtThemes = createV5Theme({
  darkPalette,
  lightPalette,
  componentThemes: v5ComponentThemes,
  accent: {
    light: accentLight,
    dark: accentDark,
  },
  childrenThemes: {
    // Include default color themes (blue, red, green, yellow, etc.)
    ...defaultChildrenThemes,

    // Semantic color themes for warnings, errors, and success states
    warning: {
      light: yellow,
      dark: yellowDark,
    },
    error: {
      light: red,
      dark: redDark,
    },
    success: {
      light: green,
      dark: greenDark,
    },
  },
})

export type Themes = typeof builtThemes

export const themes: Themes = builtThemes as Themes
