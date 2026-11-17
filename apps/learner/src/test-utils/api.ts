/** What a mocked API call answers: the shape `unwrap` reads from a fetch Response. */
export function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body }
}

/** How a request that never reached the server fails (fetch's own error on React Native). */
export const offline = () => Promise.reject(new Error('Network request failed'))
