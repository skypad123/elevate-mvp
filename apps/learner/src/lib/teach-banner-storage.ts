import AsyncStorage from '@react-native-async-storage/async-storage'

/** Where the time the Teach banner was closed is kept, on this device only. */
export const TEACH_BANNER_STORAGE_KEY = 'elevate.teachBanner'

/**
 * When the banner was last closed on this device, in milliseconds since 1970, or null if it never
 * was. A failed read or a value that is not a number counts as never closed. One file serves web
 * and native: the banner needs no synchronous read before the first paint, unlike the theme.
 */
export async function readDismissedAt(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(TEACH_BANNER_STORAGE_KEY)
    if (raw === null) return null
    const at = Number(raw)
    return Number.isFinite(at) && raw.trim() !== '' ? at : null
  } catch {
    return null
  }
}

/** Stores when the banner was closed. A failed write is ignored. */
export async function writeDismissedAt(at: number): Promise<void> {
  try {
    await AsyncStorage.setItem(TEACH_BANNER_STORAGE_KEY, String(at))
  } catch {
    // ignored: the banner stays hidden for the rest of this run only
  }
}
