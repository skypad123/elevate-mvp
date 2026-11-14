// Applies the stored theme and language before first paint, so there is no flash.
//
// This is a file, not an inline <script>: the deployed sites send `script-src 'self'`
// (infra/terraform/modules/environment/sites.tf), which blocks inline scripts. index.html loads it
// as a classic script in <head>, so it runs before the page is painted.
//
// The key and shape mirror PREFERENCES_STORAGE_KEY / preferencesSchema in @elevate/core.
// apps/support/public/preferences-init.js is the same file; change both together.
;(() => {
  try {
    const stored = JSON.parse(localStorage.getItem('elevate.preferences') || '{}')
    const root = document.documentElement
    if (stored.theme === 'light' || stored.theme === 'dark')
      root.setAttribute('data-theme', stored.theme)
    if (typeof stored.locale === 'string') root.lang = stored.locale
  } catch {
    // No stored preferences, or storage is blocked: the defaults in index.html stand.
  }
})()
