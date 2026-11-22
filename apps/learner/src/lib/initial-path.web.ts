/**
 * The address the tab opened on, read when this module first loads: before the router replaces
 * a protected address with Explore for a signed-out visitor.
 */
const opened =
  typeof window === 'undefined' ? null : `${window.location.pathname}${window.location.search}`

export async function readInitialPath(): Promise<string | null> {
  return opened
}
