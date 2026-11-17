// Applies the stored theme and language before first paint, so there is no flash.
//
// This is a file, not an inline <script>: the deployed sites send `script-src 'self'`
// (infra/terraform/modules/environment/sites.tf), which blocks inline scripts. index.html loads it
// as a classic script in <head>, so it runs before the page is painted.
//
// The key and shape mirror PREFERENCES_STORAGE_KEY / preferencesSchema in @elevate/core, and the
// language rule copies the device rule of resolveLocale (ADR 010), because a classic script can't
// import. apps/teach/public/preferences-init.js and apps/support/public/preferences-init.js are the
// same file; change both together.
;(() => {
  const root = document.documentElement
  // The browser's first language: primary subtag `zh` (zh-CN, zh-TW, ...) gives `zh`, else `en`.
  const deviceLocale = () => {
    const first = navigator.languages?.[0] || ''
    return first.split('-')[0].toLowerCase() === 'zh' ? 'zh' : 'en'
  }
  let stored = {}
  try {
    stored = JSON.parse(localStorage.getItem('elevate.preferences') || '{}') || {}
  } catch {
    // No stored preferences, or storage is blocked: the theme default in index.html stands.
  }
  if (stored.theme === 'light' || stored.theme === 'dark')
    root.setAttribute('data-theme', stored.theme)
  // `en` or `zh` is a choice; `system`, nothing, or anything else follows the browser.
  root.lang = stored.locale === 'en' || stored.locale === 'zh' ? stored.locale : deviceLocale()
})()
