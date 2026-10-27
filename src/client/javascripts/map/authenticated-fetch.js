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

  const response = await fetch(input, { ...init, headers })
  if (response.status === HTTP_UNAUTHORIZED) {
    globalThis.location.reload()
    return new Promise(() => {})
  }
  return response
}
