// Maestro JavaScript (GraalJS): request a learner magic link and expose the dev code.
// LOCALE=zh asks for it in Chinese, as the app does on a Chinese screen; otherwise none is sent.
const locale = typeof LOCALE !== 'undefined' && LOCALE ? LOCALE : undefined
const response = http.post(`${API_URL}/api/auth/magic-link`, {
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, audience: 'learner', ...(locale ? { locale } : {}) }),
})
const body = json(response.body)
if (!body.dev?.code) {
  throw new Error(
    `No dev code in response. Is the API running with DEV_ENDPOINTS_ENABLED=true? ${response.body}`,
  )
}
output.code = body.dev.code
