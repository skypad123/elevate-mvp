// Maestro JavaScript (GraalJS): request a learner magic link and expose the dev code.
const response = http.post(`${API_URL}/api/auth/magic-link`, {
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, audience: 'learner' }),
})
const body = json(response.body)
if (!body.dev?.code) {
  throw new Error(
    `No dev code in response. Is the API running with DEV_ENDPOINTS_ENABLED=true? ${response.body}`,
  )
}
output.code = body.dev.code
