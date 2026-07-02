import { describe, test, expect, vi, beforeEach } from 'vitest'

vi.mock('../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'map.apgbUrl') {
        return 'https://wms.example.com/service/ApgbBng.wmsx'
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

const { default: routes } = await import('./wms-routes.js')

const wmsHandler = routes[0].handler

function createMockRequest ({ service = 'apgb', query = {} } = {}) {
  return {
    params: { service },
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

describe('wms-proxy routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  test('proxies WMS tile requests as binary', async () => {
    const tileData = new Uint8Array([0x89, 0x50, 0x4e, 0x47])

    global.fetch.mockReturnValue(mockFetchResponse(tileData, {
      headers: { 'content-type': 'image/png', 'cache-control': 'max-age=86400' }
    }))

    const request = createMockRequest({
      query: {
        SERVICE: 'WMS',
        REQUEST: 'GetMap',
        LAYERS: 'APGB_Latest_UK_125mm',
        BBOX: '400000,300000,400256,300256',
        WIDTH: '256',
        HEIGHT: '256',
        SRS: 'EPSG:27700',
        FORMAT: 'image/png'
      }
    })
    const h = createMockH()

    await wmsHandler(request, h)

    const fetchUrl = global.fetch.mock.calls[0][0]
    expect(fetchUrl).toContain('wms.example.com/service/ApgbBng.wmsx')
    expect(fetchUrl).toContain('LAYERS=APGB_Latest_UK_125mm')
    expect(fetchUrl).toContain('SRS=EPSG')
    expect(h._response.type).toHaveBeenCalledWith('image/png')
    expect(h._response.header).toHaveBeenCalledWith('cache-control', 'max-age=86400')
  })

  test('returns 404 for unknown service', async () => {
    const request = createMockRequest({ service: 'unknown' })
    const h = createMockH()

    await wmsHandler(request, h)

    expect(global.fetch).not.toHaveBeenCalled()
    expect(h._response.code).toHaveBeenCalledWith(404)
    expect(mockLogger.warn).toHaveBeenCalledWith('WMS proxy: Unknown WMS service')
  })

  test('returns 502 with config warning when service URL is not set', async () => {
    const { config } = await import('../../config/config.js')
    config.get.mockReturnValueOnce('')

    const request = createMockRequest({ service: 'apgb' })
    const h = createMockH()

    await wmsHandler(request, h)

    expect(global.fetch).not.toHaveBeenCalled()
    expect(h._response.code).toHaveBeenCalledWith(502)
    expect(mockLogger.warn).toHaveBeenCalledWith("WMS proxy: WMS service 'apgb' is not configured")
  })

  test('passes through upstream 304 responses', async () => {
    global.fetch.mockReturnValue(mockFetchResponse('', {
      status: 304,
      headers: { etag: '"abc123"' }
    }))

    const request = createMockRequest({ query: { SERVICE: 'WMS', REQUEST: 'GetMap' } })
    request.headers['if-none-match'] = '"abc123"'
    const h = createMockH()

    await wmsHandler(request, h)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: { 'if-none-match': '"abc123"' } })
    )
    expect(h.response).toHaveBeenCalledWith()
    expect(h._response.code).toHaveBeenCalledWith(304)
    expect(h._response.header).toHaveBeenCalledWith('etag', '"abc123"')
  })

  test('passes through upstream errors', async () => {
    global.fetch.mockReturnValue(mockFetchResponse('Forbidden', { status: 403 }))

    const request = createMockRequest({ query: { SERVICE: 'WMS', REQUEST: 'GetMap' } })
    const h = createMockH()

    await wmsHandler(request, h)

    expect(h._response.code).toHaveBeenCalledWith(403)
  })

  test('returns 502 for network errors', async () => {
    global.fetch.mockReturnValue(Promise.reject(new Error('Network error')))

    const request = createMockRequest({ query: { SERVICE: 'WMS', REQUEST: 'GetMap' } })
    const h = createMockH()

    await wmsHandler(request, h)

    expect(h.response).toHaveBeenCalledWith('Map tile request failed')
    expect(h._response.code).toHaveBeenCalledWith(502)
    expect(mockLogger.error).toHaveBeenCalled()
  })

  test('forwards query parameters to upstream', async () => {
    global.fetch.mockReturnValue(mockFetchResponse(new Uint8Array([0x89]), {
      headers: { 'content-type': 'image/png' }
    }))

    const request = createMockRequest({
      query: { SERVICE: 'WMS', REQUEST: 'GetMap', FORMAT: 'image/png' }
    })
    const h = createMockH()

    await wmsHandler(request, h)

    const fetchUrl = global.fetch.mock.calls[0][0]
    expect(fetchUrl).toContain('SERVICE=WMS')
    expect(fetchUrl).toContain('REQUEST=GetMap')
    expect(fetchUrl).toContain('FORMAT=image')
  })
})
