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

function createMockRequest ({ path = '', query = {} } = {}) {
  return {
    params: { path },
    query,
    headers: {},
    server: { info: { protocol: 'http' } },
    info: { host: 'localhost:3000' }
  }
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
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
    arrayBuffer: () => Promise.resolve(body instanceof Uint8Array ? body.buffer : new TextEncoder().encode(body).buffer)
  })
}

describe('os-base-map proxy routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  describe('JSON responses (map style, TileJSON)', () => {
    test('proxies map style requests and rewrites Ordnance Survey URLs', async () => {
      const osMapStyleBody = {
        sources: {
          osVectorTiles: {
            url: 'https://api.os.uk/maps/vector/v1/vts?key=test-api-key&srs=27700'
          }
        },
        sprite: 'https://api.os.uk/maps/vector/v1/vts/resources/sprites/sprite?key=test-api-key&srs=27700',
        glyphs: 'https://api.os.uk/maps/vector/v1/vts/resources/fonts/{fontstack}/{range}.pbf?key=test-api-key&srs=27700'
      }

      global.fetch.mockReturnValue(mockFetchResponse(osMapStyleBody, {
        headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' }
      }))

      const request = createMockRequest({ path: 'resources/styles' })
      const h = createMockH()

      await handler(request, h)

      const responseBody = h.response.mock.calls[0][0]
      expect(responseBody).toContain('http://localhost:3000/os-base-map')
      expect(responseBody).not.toContain('api.os.uk')
      expect(responseBody).not.toContain('test-api-key')
      expect(h._response.type).toHaveBeenCalledWith('application/json')
      expect(h._response.header).toHaveBeenCalledWith('cache-control', 'max-age=3600')
    })

    test('proxies TileJSON at the root path', async () => {
      const tileJson = {
        tiles: ['https://api.os.uk/maps/vector/v1/vts/tile/{z}/{y}/{x}.pbf?key=test-api-key&srs=27700']
      }

      global.fetch.mockReturnValue(mockFetchResponse(tileJson, {
        headers: { 'content-type': 'application/json' }
      }))

      const request = createMockRequest()
      const h = createMockH()

      await handler(request, h)

      const responseBody = h.response.mock.calls[0][0]
      expect(responseBody).toContain('http://localhost:3000/os-base-map/tile/{z}/{y}/{x}.pbf')
    })

    test('uses x-forwarded-proto when present', async () => {
      global.fetch.mockReturnValue(mockFetchResponse({
        url: 'https://api.os.uk/maps/vector/v1/vts?key=test-api-key&srs=27700'
      }, {
        headers: { 'content-type': 'application/json' }
      }))

      const request = createMockRequest({ path: 'resources/styles' })
      request.headers['x-forwarded-proto'] = 'https'
      const h = createMockH()

      await handler(request, h)

      const responseBody = h.response.mock.calls[0][0]
      expect(responseBody).toContain('https://localhost:3000/os-base-map')
    })
  })

  describe('binary responses (tiles, sprites)', () => {
    test('proxies .pbf tiles as binary', async () => {
      const tileData = new Uint8Array([0x1a, 0x02, 0x03])

      global.fetch.mockReturnValue(mockFetchResponse(tileData, {
        headers: { 'content-type': 'application/octet-stream', 'cache-control': 'max-age=86400' }
      }))

      const request = createMockRequest({ path: 'tile/7/63/42.pbf' })
      const h = createMockH()

      await handler(request, h)

      expect(h.response).toHaveBeenCalled()
      expect(h._response.type).toHaveBeenCalledWith('application/octet-stream')
      expect(h._response.header).toHaveBeenCalledWith('cache-control', 'max-age=86400')
    })

    test('proxies .png sprites as binary', async () => {
      global.fetch.mockReturnValue(mockFetchResponse(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        headers: { 'content-type': 'image/png', 'cache-control': 'no-cache' }
      }))

      const request = createMockRequest({ path: 'resources/sprites/sprite.png' })
      const h = createMockH()

      await handler(request, h)

      expect(h.response).toHaveBeenCalled()
      expect(h._response.type).toHaveBeenCalledWith('image/png')
      expect(h._response.header).toHaveBeenCalledWith('cache-control', 'no-cache')
    })
  })

  describe('error handling', () => {
    test('passes through upstream error status codes', async () => {
      global.fetch.mockReturnValue(mockFetchResponse('Forbidden', { status: 403 }))

      const request = createMockRequest({ path: 'tile/15/10706/16499.pbf' })
      const h = createMockH()

      await handler(request, h)

      expect(h._response.code).toHaveBeenCalledWith(403)
    })

    test('returns 502 for network errors', async () => {
      global.fetch.mockReturnValue(Promise.reject(new Error('Network error')))

      const request = createMockRequest({ path: 'resources/styles' })
      const h = createMockH()

      await handler(request, h)

      expect(h.response).toHaveBeenCalledWith('Map tile request failed')
      expect(h._response.code).toHaveBeenCalledWith(502)
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('URL construction', () => {
    test('appends API key and srs=27700 to all requests', async () => {
      global.fetch.mockReturnValue(mockFetchResponse({}, {
        headers: { 'content-type': 'application/json' }
      }))

      const request = createMockRequest({ path: 'resources/styles' })
      const h = createMockH()

      await handler(request, h)

      const fetchUrl = global.fetch.mock.calls[0][0]
      expect(fetchUrl).toContain('key=test-api-key')
      expect(fetchUrl).toContain('srs=27700')
    })

    test('forwards query parameters from the client', async () => {
      global.fetch.mockReturnValue(mockFetchResponse({}, {
        headers: { 'content-type': 'application/json' }
      }))

      const request = createMockRequest({ path: 'resources/styles', query: { f: 'json' } })
      const h = createMockH()

      await handler(request, h)

      const fetchUrl = global.fetch.mock.calls[0][0]
      expect(fetchUrl).toContain('f=json')
    })
  })
})
