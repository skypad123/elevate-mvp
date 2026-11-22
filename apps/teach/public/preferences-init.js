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
//
// A `?lang=en|zh` link (the learner app's Teach banner) is kept as this site's language when no
// language is stored here yet, so it outlasts redirects and sign-in. A language already chosen here
// is never overwritten. The parameter is then removed from the address bar either way.
;(() => {
  const KEY = 'elevate.preferences'
  const root = document.documentElement
  const isLocale = (value) => value === 'en' || value === 'zh'
  // The browser's first language: primary subtag `zh` (zh-CN, zh-TW, ...) gives `zh`, else `en`.
  const deviceLocale = () => {
    const first = navigator.languages?.[0] || ''
    return first.split('-')[0].toLowerCase() === 'zh' ? 'zh' : 'en'
  }
  let stored = {}
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) stored = parsed
  } catch {
    // No stored preferences, or storage is blocked: the theme default in index.html stands.
  }

  const params = new URLSearchParams(location.search)
  if (params.has('lang')) {
    const lang = params.get('lang')
    if (isLocale(lang) && !isLocale(stored.locale)) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...stored, locale: lang }))
        stored = { ...stored, locale: lang }
      } catch {
        // Storage is blocked: the app can't keep the language, so the page follows the browser.
      }
    }
    params.delete('lang')
    const query = params.toString()
    try {
      history.replaceState(
        history.state,
        '',
        location.pathname + (query ? `?${query}` : '') + location.hash,
      )
    } catch {
      // A browser that refuses replaceState keeps `lang` in the address bar; nothing else changes.
    }
  }

  if (stored.theme === 'light' || stored.theme === 'dark')
    root.setAttribute('data-theme', stored.theme)
  // `en` or `zh` is a choice; `system`, nothing, or anything else follows the browser.
  root.lang = isLocale(stored.locale) ? stored.locale : deviceLocale()
})()
