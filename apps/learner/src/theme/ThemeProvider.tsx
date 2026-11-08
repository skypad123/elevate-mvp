import { createContext, type PropsWithChildren, useContext, useMemo } from 'react'
import { useColorScheme } from 'react-native'
import { buildTheme, type Theme } from './index'

const ThemeContext = createContext<Theme>(buildTheme('light'))

export function ThemeProvider({ children }: PropsWithChildren) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const theme = useMemo(() => buildTheme(scheme), [scheme])
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
