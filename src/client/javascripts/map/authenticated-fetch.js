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

  const response = await logExternalCall('Frontend', 'fetch', () => fetch(input, { ...init, headers }))
  if (response.status === HTTP_UNAUTHORIZED) {
    globalThis.location.reload()
    return new Promise(() => {})
  }
  return response
}

/**
 * Log a browser API operation without exposing request data or credentials.
 * @template T
 * @param {string} service
 * @param {string} operation
 * @param {() => Promise<T>} call
 * @returns {Promise<T>}
 */
export async function logExternalCall (service, operation, call) {
  const context = { service, operation }
  const startedAt = performance.now()
  console.debug(context, 'External API call started')
  try {
    const result = await call()
    const response = /** @type {{ status?: number }} */ (result)
    console.debug({ ...context, statusCode: response?.status, durationMs: performance.now() - startedAt }, 'External API call completed')
    return result
  } catch (error) {
    console.debug({ ...context, durationMs: performance.now() - startedAt }, 'External API call failed')
    throw error
  }
}
