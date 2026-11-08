/** Public learner site, for “view course page” links. */
export function learnerUrl(path = ''): string {
  const fromEnv = (import.meta.env.VITE_LEARNER_URL as string | undefined)?.replace(/\/$/, '')
  const base =
    fromEnv && !/localhost|127\.0\.0\.1/.test(fromEnv)
      ? fromEnv
      : `${window.location.protocol}//${window.location.hostname}:8081`
  return `${base}${path}`
}
