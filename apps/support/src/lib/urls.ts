/**
 * The Teach portal, for "Open in Teach" links. A configured URL that points at localhost is
 * treated as "the machine serving this page", so the link also works from another device.
 */
export function teachUrl(path = ''): string {
  const fromEnv = (import.meta.env.VITE_TEACH_URL as string | undefined)?.replace(/\/$/, '')
  const base =
    fromEnv && !/localhost|127\.0\.0\.1/.test(fromEnv)
      ? fromEnv
      : `${window.location.protocol}//${window.location.hostname}:5173`
  return `${base}${path}`
}
