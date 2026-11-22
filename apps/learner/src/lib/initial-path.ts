import * as Linking from 'expo-linking'

/** The path and query an opened link asked for, or null when the app opened without one. */
export async function readInitialPath(): Promise<string | null> {
  const url = await Linking.getInitialURL()
  if (!url) return null
  const { path, queryParams } = Linking.parse(url)
  if (path === null) return null
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(queryParams ?? {})) {
    if (typeof value === 'string') query.set(key, value)
  }
  const search = query.toString()
  return `/${path.replace(/^\//, '')}${search ? `?${search}` : ''}`
}
