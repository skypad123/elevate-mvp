// Sets <html lang> before first paint, so the page's language is right from the start (screen
// readers, fonts and the browser's translate prompt read it before the app has loaded).
//
// A file, not an inline <script>: the deployed site sends `script-src 'self'`. index.html loads it
// as a classic script in <head>.
//
// It copies resolveLocale from @elevate/core (ADR 010) as far as the page alone can know it: a
// stored choice, then `?lang`, then the browser's first language. The signed-in account's language
// is not known yet; the app sets the attribute again once it has resolved. It never stores
// anything. The key mirrors PREFERENCES_STORAGE_KEY. The device rule is the same as in
// apps/teach/public/preferences-init.js and apps/support/public/preferences-init.js.
;(() => {
  const supported = (value) => (value === 'en' || value === 'zh' ? value : null)
  let stored = {}
  try {
    stored = JSON.parse(localStorage.getItem('elevate.preferences') || '{}') || {}
  } catch {
    // Nothing stored, or storage is blocked: fall through to ?lang and the browser.
  }
  let param = null
  try {
    param = new URLSearchParams(location.search).get('lang')
  } catch {
    param = null
  }
  // The browser's first language: primary subtag `zh` (zh-CN, zh-TW, ...) gives `zh`, else `en`.
  const first = navigator.languages?.[0] || ''
  const device = first.split('-')[0].toLowerCase() === 'zh' ? 'zh' : 'en'
  document.documentElement.lang = supported(stored.locale) || supported(param) || device
})()
