import { createSystemFont, defaultConfig } from '@tamagui/config/v5'
import { createTamagui } from 'tamagui'
import { themes } from './src/themes'

const isWeb = process.env.TAMAGUI_TARGET === 'web'

const mono = createSystemFont({
  font: {
    family: isWeb
      ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
      : 'Menlo',
    weight: {
      1: '400',
      7: '700',
    },
    letterSpacing: {
      1: 2,
      2: 2.4,
      3: 3,
      4: 0.4,
    },
  },
})

export const config = createTamagui({
  ...defaultConfig,
  themes,
  fonts: {
    ...defaultConfig.fonts,
    mono,
  },
  settings: {
    ...defaultConfig.settings,
    onlyAllowShorthands: false,
  },
})

export default config

export type AppConfig = typeof config

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}
