import { breakpoints } from '@elevate/tokens'
import { Platform, useWindowDimensions } from 'react-native'

export function useBreakpoint() {
  const { width } = useWindowDimensions()
  return {
    width,
    isSm: width >= breakpoints.sm,
    isMd: width >= breakpoints.md,
    isLg: width >= breakpoints.lg,
    isXl: width >= breakpoints.xl,
    /** Wide web gets a top navigation bar; everything else gets the pill tab bar. */
    isWideWeb: Platform.OS === 'web' && width >= breakpoints.md,
  }
}
