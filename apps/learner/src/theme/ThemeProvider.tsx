import type { ColorScheme } from '@elevate/tokens'
import { createContext, type PropsWithChildren, useContext, useMemo } from 'react'
import { useColorScheme } from 'react-native'
import { usePreferences } from '@/lib/preferences'
import { buildTheme, type Theme } from './index'

const ThemeContext = createContext<Theme>(buildTheme('light'))

/** Resolves the Appearance preference: an explicit choice wins, `system` follows the OS. */
export function ThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme()
  const { preferences } = usePreferences()
  const scheme: ColorScheme =
    preferences.theme === 'system' ? (system === 'dark' ? 'dark' : 'light') : preferences.theme
  const theme = useMemo(() => buildTheme(scheme), [scheme])
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
