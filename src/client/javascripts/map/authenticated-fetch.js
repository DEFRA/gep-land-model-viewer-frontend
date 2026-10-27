const HTTP_UNAUTHORIZED = 401

/**
 * @param {RequestInfo | URL} input
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
export async function authenticatedFetch (input, init) {
  const headers = new Headers(init?.headers)
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  const response = await debugFetch(input, { ...init, headers })
  if (response.status === HTTP_UNAUTHORIZED) {
    globalThis.location.reload()
    return new Promise(() => {})
  }
  return response
}

/**
 * Debug browser requests without exposing URLs, headers or payloads.
 * @param {RequestInfo | URL} input
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
export async function debugFetch (input, init) {
  const startedAt = Date.now()
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
  console.debug('API call started', { method })
  try {
    const response = await (init === undefined ? fetch(input) : fetch(input, init))
    console.debug('API call completed', { method, statusCode: response.status, durationMs: Date.now() - startedAt })
    return response
  } catch (error) {
    console.debug('API call failed', { method, durationMs: Date.now() - startedAt })
    throw error
  }
}
