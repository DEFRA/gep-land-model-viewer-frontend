import { describe, test, expect, vi, beforeEach } from 'vitest'

vi.mock('../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'map.osApiKey') {
        return 'test-api-key'
      }
      return null
    })
  }
}))

const mockLogger = vi.hoisted(() => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../common/helpers/logging/logger.js', () => ({
  createLogger: () => mockLogger
}))

const { default: routes } = await import('./routes.js')

const handler = routes[0].handler

function createMockRequest ({ query = {} } = {}) {
  return { query }
}

function createMockH () {
  const response = {
    type: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    code: vi.fn().mockReturnThis()
  }
  return {
    response: vi.fn().mockReturnValue(response),
    _response: response
  }
}

function mockFetchResponse (body, { status = 200, headers = {} } = {}) {
  const headerMap = new Map(Object.entries(headers))
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (key) => headerMap.get(key.toLowerCase()) || null
    },
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body))
  })
}

describe('os-names-search proxy routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  describe('successful responses', () => {
    test('proxies search results from OS Names API', async () => {
      const osNamesResponse = {
        results: [
          { GAZETTEER_ENTRY: { NAME1: 'Bristol', TYPE: 'City' } }
        ]
      }

      global.fetch.mockReturnValue(mockFetchResponse(osNamesResponse, {
        headers: { 'content-type': 'application/json', 'cache-control': 'max-age=300' }
      }))

      const request = createMockRequest({ query: { query: 'Bristol' } })
      const h = createMockH()

      await handler(request, h)

      const responseBody = h.response.mock.calls[0][0]
      expect(responseBody).toContain('Bristol')
      expect(responseBody).not.toContain('test-api-key')
      expect(h._response.type).toHaveBeenCalledWith('application/json')
      expect(h._response.header).toHaveBeenCalledWith('cache-control', 'max-age=300')
    })

    test('uses no-cache when upstream has no cache-control header', async () => {
      global.fetch.mockReturnValue(mockFetchResponse({ results: [] }, {
        headers: { 'content-type': 'application/json' }
      }))

      const request = createMockRequest({ query: { query: 'test' } })
      const h = createMockH()

      await handler(request, h)

      expect(h._response.header).toHaveBeenCalledWith('cache-control', 'no-cache')
    })

    test('trims whitespace from query before sending upstream', async () => {
      global.fetch.mockReturnValue(mockFetchResponse({ results: [] }, {
        headers: { 'content-type': 'application/json' }
      }))

      const request = createMockRequest({ query: { query: '  Bristol  ' } })
      const h = createMockH()

      await handler(request, h)

      const fetchUrl = global.fetch.mock.calls[0][0]
      expect(fetchUrl).toContain('query=Bristol')
    })
  })

  describe('URL construction', () => {
    test('appends API key to upstream URL', async () => {
      global.fetch.mockReturnValue(mockFetchResponse({ results: [] }, {
        headers: { 'content-type': 'application/json' }
      }))

      const request = createMockRequest({ query: { query: 'London' } })
      const h = createMockH()

      await handler(request, h)

      const fetchUrl = global.fetch.mock.calls[0][0]
      expect(fetchUrl).toContain('key=test-api-key')
      expect(fetchUrl).toContain('query=London')
      expect(fetchUrl).toContain('https://api.os.uk/search/names/v1/find')
    })
  })

  describe('validation', () => {
    test('returns 400 when query parameter is missing', async () => {
      const request = createMockRequest({ query: {} })
      const h = createMockH()

      await handler(request, h)

      expect(h._response.code).toHaveBeenCalledWith(400)
      expect(global.fetch).not.toHaveBeenCalled()
    })

    test('returns 400 when query is empty string', async () => {
      const request = createMockRequest({ query: { query: '' } })
      const h = createMockH()

      await handler(request, h)

      expect(h._response.code).toHaveBeenCalledWith(400)
      expect(global.fetch).not.toHaveBeenCalled()
    })

    test('returns 400 when query is only whitespace', async () => {
      const request = createMockRequest({ query: { query: '   ' } })
      const h = createMockH()

      await handler(request, h)

      expect(h._response.code).toHaveBeenCalledWith(400)
      expect(global.fetch).not.toHaveBeenCalled()
    })

    test('returns 400 when query exceeds maximum length', async () => {
      const request = createMockRequest({ query: { query: 'a'.repeat(201) } })
      const h = createMockH()

      await handler(request, h)

      expect(h._response.code).toHaveBeenCalledWith(400)
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    test('passes through upstream error status codes', async () => {
      global.fetch.mockReturnValue(mockFetchResponse('Forbidden', { status: 403 }))

      const request = createMockRequest({ query: { query: 'test' } })
      const h = createMockH()

      await handler(request, h)

      expect(h._response.code).toHaveBeenCalledWith(403)
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    test('returns 502 for network errors', async () => {
      global.fetch.mockReturnValue(Promise.reject(new Error('Network error')))

      const request = createMockRequest({ query: { query: 'test' } })
      const h = createMockH()

      await handler(request, h)

      expect(h._response.code).toHaveBeenCalledWith(502)
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })
})
