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

const { default: routes } = await import('./map-routes.js')

const vtsHandler = routes[0].handler
const ngdHandler = routes[1].handler
const rasterHandler = routes[2].handler

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

describe('os-proxy VTS routes', () => {
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

      await vtsHandler(request, h)

      const responseBody = h.response.mock.calls[0][0]
      expect(responseBody).toContain('http://localhost:3000/os/vts')
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

      await vtsHandler(request, h)

      const responseBody = h.response.mock.calls[0][0]
      expect(responseBody).toContain('http://localhost:3000/os/vts/tile/{z}/{y}/{x}.pbf')
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

      await vtsHandler(request, h)

      const responseBody = h.response.mock.calls[0][0]
      expect(responseBody).toContain('https://localhost:3000/os/vts')
    })

    test('uses x-forwarded-host when present', async () => {
      global.fetch.mockReturnValue(mockFetchResponse({
        url: 'https://api.os.uk/maps/vector/v1/vts?key=test-api-key&srs=27700'
      }, {
        headers: { 'content-type': 'application/json' }
      }))

      const request = createMockRequest({ path: 'resources/styles' })
      request.headers['x-forwarded-proto'] = 'https'
      request.headers['x-forwarded-host'] = 'example.gov.uk'
      const h = createMockH()

      await vtsHandler(request, h)

      const responseBody = h.response.mock.calls[0][0]
      expect(responseBody).toContain('https://example.gov.uk/os/vts')
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

      await vtsHandler(request, h)

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

      await vtsHandler(request, h)

      expect(h.response).toHaveBeenCalled()
      expect(h._response.type).toHaveBeenCalledWith('image/png')
      expect(h._response.header).toHaveBeenCalledWith('cache-control', 'no-cache')
    })
  })

  describe('caching', () => {
    test('passes through upstream 304 responses without a body', async () => {
      global.fetch.mockReturnValue(mockFetchResponse('', {
        status: 304,
        headers: { etag: '"abc123"' }
      }))

      const request = createMockRequest({ path: 'tile/7/63/42.pbf' })
      request.headers['if-none-match'] = '"abc123"'
      const h = createMockH()

      await vtsHandler(request, h)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ headers: { 'if-none-match': '"abc123"' } })
      )
      expect(h.response).toHaveBeenCalledWith()
      expect(h._response.code).toHaveBeenCalledWith(304)
      expect(h._response.header).toHaveBeenCalledWith('etag', '"abc123"')
    })

    test('rewritten JSON responses do not forward upstream validators', async () => {
      // The proxy rewrites the body, so upstream validators do not describe it.
      global.fetch.mockReturnValue(mockFetchResponse({ version: 8 }, {
        headers: {
          'content-type': 'application/json',
          etag: '"abc123"',
          'last-modified': 'Fri, 05 Jun 2026 15:53:08 GMT'
        }
      }))

      const request = createMockRequest({ path: 'resources/styles' })
      const h = createMockH()

      await vtsHandler(request, h)

      expect(h._response.header).not.toHaveBeenCalledWith('etag', expect.anything())
      expect(h._response.header).not.toHaveBeenCalledWith('last-modified', expect.anything())
    })
  })

  describe('error handling', () => {
    test('passes through upstream error status codes', async () => {
      global.fetch.mockReturnValue(mockFetchResponse('Forbidden', { status: 403 }))

      const request = createMockRequest({ path: 'tile/15/10706/16499.pbf' })
      const h = createMockH()

      await vtsHandler(request, h)

      expect(h._response.code).toHaveBeenCalledWith(403)
    })

    test('returns 502 for network errors', async () => {
      global.fetch.mockReturnValue(Promise.reject(new Error('Network error')))

      const request = createMockRequest({ path: 'resources/styles' })
      const h = createMockH()

      await vtsHandler(request, h)

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

      await vtsHandler(request, h)

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

      await vtsHandler(request, h)

      const fetchUrl = global.fetch.mock.calls[0][0]
      expect(fetchUrl).toContain('f=json')
    })
  })
})

describe('os-proxy NGD routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  describe('JSON responses (style, TileJSON)', () => {
    test('proxies style requests and rewrites OS URLs', async () => {
      const styleBody = {
        sources: {
          'ngd-base': {
            url: 'https://api.os.uk/maps/vector/ngd/ota/v1/collections/ngd-base/tiles/27700?key=test-api-key'
          }
        },
        sprite: 'https://api.os.uk/maps/vector/ngd/ota/v1/collections/ngd-base/styles/27700/sprites/sprite?key=test-api-key',
        glyphs: 'https://api.os.uk/maps/vector/ngd/ota/v1/collections/ngd-base/styles/27700/fonts/{fontstack}/{range}.pbf?key=test-api-key'
      }

      global.fetch.mockReturnValue(mockFetchResponse(styleBody, {
        headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' }
      }))

      const request = createMockRequest({ path: 'collections/ngd-base/styles/27700' })
      const h = createMockH()

      await ngdHandler(request, h)

      const responseBody = h.response.mock.calls[0][0]
      expect(responseBody).toContain('http://localhost:3000/os/ngd')
      expect(responseBody).not.toContain('api.os.uk')
      expect(responseBody).not.toContain('test-api-key')
      expect(h._response.type).toHaveBeenCalledWith('application/json')
      expect(h._response.header).toHaveBeenCalledWith('cache-control', 'max-age=3600')
    })

    test('proxies tile metadata at a collection path', async () => {
      const tileJson = {
        tiles: ['https://api.os.uk/maps/vector/ngd/ota/v1/collections/ngd-base/tiles/27700/{tileMatrix}/{tileRow}/{tileCol}?key=test-api-key']
      }

      global.fetch.mockReturnValue(mockFetchResponse(tileJson, {
        headers: { 'content-type': 'application/json' }
      }))

      const request = createMockRequest({ path: 'collections/ngd-base/tiles/27700' })
      const h = createMockH()

      await ngdHandler(request, h)

      const responseBody = h.response.mock.calls[0][0]
      expect(responseBody).toContain('http://localhost:3000/os/ngd/collections/ngd-base/tiles/27700/{tileMatrix}/{tileRow}/{tileCol}')
    })

    test('uses x-forwarded-proto when present', async () => {
      global.fetch.mockReturnValue(mockFetchResponse({
        url: 'https://api.os.uk/maps/vector/ngd/ota/v1/collections/ngd-base/tiles/27700?key=test-api-key'
      }, {
        headers: { 'content-type': 'application/json' }
      }))

      const request = createMockRequest({ path: 'collections/ngd-base/styles/27700' })
      request.headers['x-forwarded-proto'] = 'https'
      const h = createMockH()

      await ngdHandler(request, h)

      const responseBody = h.response.mock.calls[0][0]
      expect(responseBody).toContain('https://localhost:3000/os/ngd')
    })

    test('uses x-forwarded-host when present', async () => {
      global.fetch.mockReturnValue(mockFetchResponse({
        url: 'https://api.os.uk/maps/vector/ngd/ota/v1/collections/ngd-base/tiles/27700?key=test-api-key'
      }, {
        headers: { 'content-type': 'application/json' }
      }))

      const request = createMockRequest({ path: 'collections/ngd-base/styles/27700' })
      request.headers['x-forwarded-proto'] = 'https'
      request.headers['x-forwarded-host'] = 'example.gov.uk'
      const h = createMockH()

      await ngdHandler(request, h)

      const responseBody = h.response.mock.calls[0][0]
      expect(responseBody).toContain('https://example.gov.uk/os/ngd')
    })
  })

  describe('binary responses (tiles, sprites)', () => {
    test('proxies OGC vector tiles as binary based on content type', async () => {
      const tileData = new Uint8Array([0x1a, 0x02, 0x03])

      global.fetch.mockReturnValue(mockFetchResponse(tileData, {
        headers: { 'content-type': 'application/octet-stream', 'cache-control': 'max-age=86400' }
      }))

      const request = createMockRequest({ path: 'collections/ngd-base/tiles/27700/7/63/42' })
      const h = createMockH()

      await ngdHandler(request, h)

      expect(h.response).toHaveBeenCalled()
      expect(h._response.type).toHaveBeenCalledWith('application/octet-stream')
      expect(h._response.header).toHaveBeenCalledWith('cache-control', 'max-age=86400')
    })

    test('proxies sprite images as binary based on content type', async () => {
      global.fetch.mockReturnValue(mockFetchResponse(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        headers: { 'content-type': 'image/png', 'cache-control': 'no-cache' }
      }))

      const request = createMockRequest({ path: 'collections/ngd-base/styles/27700/sprites/sprite.png' })
      const h = createMockH()

      await ngdHandler(request, h)

      expect(h.response).toHaveBeenCalled()
      expect(h._response.type).toHaveBeenCalledWith('image/png')
      expect(h._response.header).toHaveBeenCalledWith('cache-control', 'no-cache')
    })

    test('proxies font glyphs as binary based on content type', async () => {
      global.fetch.mockReturnValue(mockFetchResponse(new Uint8Array([0x00, 0x01]), {
        headers: { 'content-type': 'application/x-protobuf' }
      }))

      const request = createMockRequest({ path: 'collections/ngd-base/styles/27700/fonts/Open Sans Bold/0-255.pbf' })
      const h = createMockH()

      await ngdHandler(request, h)

      expect(h.response).toHaveBeenCalled()
      expect(h._response.type).toHaveBeenCalledWith('application/x-protobuf')
    })
  })

  describe('caching', () => {
    test('binary responses default to one-day private caching and forward validators', async () => {
      global.fetch.mockReturnValue(mockFetchResponse(new Uint8Array([0x1a]), {
        headers: {
          'content-type': 'application/octet-stream',
          etag: '"abc123"',
          'last-modified': 'Fri, 05 Jun 2026 15:53:08 GMT'
        }
      }))

      const request = createMockRequest({ path: 'collections/ngd-base/tiles/27700/12/2700/2300' })
      const h = createMockH()

      await ngdHandler(request, h)

      expect(h._response.header).toHaveBeenCalledWith('cache-control', 'private, max-age=86400')
      expect(h._response.header).toHaveBeenCalledWith('etag', '"abc123"')
      expect(h._response.header).toHaveBeenCalledWith('last-modified', 'Fri, 05 Jun 2026 15:53:08 GMT')
    })

    test('forwards conditional request headers upstream', async () => {
      global.fetch.mockReturnValue(mockFetchResponse(new Uint8Array([0x1a]), {
        headers: { 'content-type': 'application/octet-stream' }
      }))

      const request = createMockRequest({ path: 'collections/ngd-base/tiles/27700/12/2700/2300' })
      request.headers['if-none-match'] = '"abc123"'
      const h = createMockH()

      await ngdHandler(request, h)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ headers: { 'if-none-match': '"abc123"' } })
      )
    })

    test('passes through upstream 304 responses without a body', async () => {
      global.fetch.mockReturnValue(mockFetchResponse('', {
        status: 304,
        headers: { etag: '"abc123"' }
      }))

      const request = createMockRequest({ path: 'collections/ngd-base/tiles/27700/12/2700/2300' })
      request.headers['if-none-match'] = '"abc123"'
      const h = createMockH()

      await ngdHandler(request, h)

      expect(h.response).toHaveBeenCalledWith()
      expect(h._response.code).toHaveBeenCalledWith(304)
      expect(h._response.header).toHaveBeenCalledWith('etag', '"abc123"')
      expect(h._response.header).not.toHaveBeenCalledWith('cache-control', expect.anything())
    })
  })

  describe('malformed JSON passthrough', () => {
    test('returns body unchanged when upstream JSON is unparseable', async () => {
      const malformed = '{not valid json'

      global.fetch.mockReturnValue(mockFetchResponse(malformed, {
        headers: { 'content-type': 'application/json' }
      }))

      const request = createMockRequest({ path: 'collections/ngd-base/styles/27700' })
      const h = createMockH()

      await ngdHandler(request, h)

      const responseBody = h.response.mock.calls[0][0]
      expect(responseBody).toBe(malformed)
    })
  })

  describe('error handling', () => {
    test('passes through upstream error status codes', async () => {
      global.fetch.mockReturnValue(mockFetchResponse('Forbidden', {
        status: 403,
        headers: { 'content-type': 'text/plain' }
      }))

      const request = createMockRequest({ path: 'collections/ngd-base/tiles/27700/15/10706/16499' })
      const h = createMockH()

      await ngdHandler(request, h)

      expect(h._response.code).toHaveBeenCalledWith(403)
    })

    test('returns 502 for network errors', async () => {
      global.fetch.mockReturnValue(Promise.reject(new Error('Network error')))

      const request = createMockRequest({ path: 'collections/ngd-base/styles/27700' })
      const h = createMockH()

      await ngdHandler(request, h)

      expect(h.response).toHaveBeenCalledWith('Map tile request failed')
      expect(h._response.code).toHaveBeenCalledWith(502)
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('URL construction', () => {
    test('appends API key to all requests', async () => {
      global.fetch.mockReturnValue(mockFetchResponse({}, {
        headers: { 'content-type': 'application/json' }
      }))

      const request = createMockRequest({ path: 'collections/ngd-base/styles/27700' })
      const h = createMockH()

      await ngdHandler(request, h)

      const fetchUrl = global.fetch.mock.calls[0][0]
      expect(fetchUrl).toContain('key=test-api-key')
      expect(fetchUrl).toContain('api.os.uk/maps/vector/ngd/ota/v1/')
    })

    test('forwards query parameters from the client', async () => {
      global.fetch.mockReturnValue(mockFetchResponse({}, {
        headers: { 'content-type': 'application/json' }
      }))

      const request = createMockRequest({ path: 'collections/ngd-base/tiles/27700', query: { f: 'json' } })
      const h = createMockH()

      await ngdHandler(request, h)

      const fetchUrl = global.fetch.mock.calls[0][0]
      expect(fetchUrl).toContain('f=json')
    })
  })
})

describe('os-proxy raster routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  test('proxies raster tile requests as binary', async () => {
    const tileData = new Uint8Array([0x89, 0x50, 0x4e, 0x47])

    global.fetch.mockReturnValue(mockFetchResponse(tileData, {
      headers: { 'content-type': 'image/png', 'cache-control': 'max-age=86400' }
    }))

    const request = createMockRequest({ path: 'Outdoor_27700/7/63/42.png' })
    const h = createMockH()

    await rasterHandler(request, h)

    const fetchUrl = global.fetch.mock.calls[0][0]
    expect(fetchUrl).toContain('api.os.uk/maps/raster/v1/zxy/')
    expect(fetchUrl).toContain('key=test-api-key')
    expect(h._response.type).toHaveBeenCalledWith('image/png')
  })

  test('passes through upstream 304 responses without a body', async () => {
    global.fetch.mockReturnValue(mockFetchResponse('', {
      status: 304,
      headers: { 'last-modified': 'Fri, 05 Jun 2026 15:53:08 GMT' }
    }))

    const request = createMockRequest({ path: 'Outdoor_27700/7/63/42.png' })
    request.headers['if-modified-since'] = 'Fri, 05 Jun 2026 15:53:08 GMT'
    const h = createMockH()

    await rasterHandler(request, h)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: { 'if-modified-since': 'Fri, 05 Jun 2026 15:53:08 GMT' } })
    )
    expect(h.response).toHaveBeenCalledWith()
    expect(h._response.code).toHaveBeenCalledWith(304)
    expect(h._response.header).toHaveBeenCalledWith('last-modified', 'Fri, 05 Jun 2026 15:53:08 GMT')
  })

  test('passes through upstream errors', async () => {
    global.fetch.mockReturnValue(mockFetchResponse('Forbidden', {
      status: 403,
      headers: { 'content-type': 'text/plain' }
    }))

    const request = createMockRequest({ path: 'Outdoor_27700/7/63/42.png' })
    const h = createMockH()

    await rasterHandler(request, h)

    expect(h._response.code).toHaveBeenCalledWith(403)
  })

  test('returns 502 for network errors', async () => {
    global.fetch.mockReturnValue(Promise.reject(new Error('Network error')))

    const request = createMockRequest({ path: 'Outdoor_27700/7/63/42.png' })
    const h = createMockH()

    await rasterHandler(request, h)

    expect(h.response).toHaveBeenCalledWith('Map tile request failed')
    expect(h._response.code).toHaveBeenCalledWith(502)
  })
})
