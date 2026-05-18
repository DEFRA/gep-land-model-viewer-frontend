import { vi, describe, test, expect, beforeEach } from 'vitest'
import Hapi from '@hapi/hapi'

import { statusCodes } from '../common/constants/status-codes.js'

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}))

vi.mock('../common/helpers/logging/logger.js', () => ({
  createLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  })
}))

const { styleRoutes, resetStyleCache } = await import('./style.js')

const { readFile } = await import('node:fs/promises')

describe('GET /map/style/{filename}', () => {
  let server

  beforeEach(async () => {
    server = Hapi.server()
    server.route(styleRoutes)
    resetStyleCache()
    vi.clearAllMocks()
  })

  test('returns 404 for unknown style', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/map/style/Unknown_Style.json'
    })

    expect(res.statusCode).toBe(statusCodes.notFound)
    expect(res.result).toBe('Unknown style')
  })

  test('returns 404 for path traversal attempt', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/map/style/../../../etc/passwd'
    })

    expect(res.statusCode).toBe(statusCodes.notFound)
  })

  test('returns style JSON for supported style', async () => {
    const mockStyle = JSON.stringify({
      version: 8,
      sources: {
        'os-vts': { type: 'vector', tiles: ['/os/vts/tiles/{z}/{x}/{y}.pbf'] }
      }
    })
    readFile.mockResolvedValue(mockStyle)

    const res = await server.inject({
      method: 'GET',
      url: '/map/style/OS_VTS_27700_Outdoor.json'
    })

    expect(res.statusCode).toBe(statusCodes.ok)
    expect(res.headers['content-type']).toContain('application/json')
    expect(res.headers['cache-control']).toBe('public, max-age=3600')
  })

  test('rewrites proxy paths to absolute URLs', async () => {
    const mockStyle = JSON.stringify({
      sources: {
        'os-vts': { tiles: ['/os/vts/tiles/{z}/{x}/{y}.pbf'] }
      },
      sprite: '/os/vts/sprite',
      glyphs: '/os/vts/fonts/{fontstack}/{range}.pbf'
    })
    readFile.mockResolvedValue(mockStyle)

    const res = await server.inject({
      method: 'GET',
      url: '/map/style/OS_VTS_27700_Outdoor.json',
      headers: {
        host: 'localhost:3000'
      }
    })

    const body = res.result
    expect(body).toContain('http://localhost:3000/os/vts/tiles')
    expect(body).toContain('http://localhost:3000/os/vts/sprite')
    expect(body).toContain('http://localhost:3000/os/vts/fonts')
  })

  test('uses x-forwarded headers for origin', async () => {
    const mockStyle = JSON.stringify({ sprite: '/os/vts/sprite' })
    readFile.mockResolvedValue(mockStyle)

    const res = await server.inject({
      method: 'GET',
      url: '/map/style/OS_VTS_27700_Road.json',
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'example.gov.uk'
      }
    })

    expect(res.result).toContain('https://example.gov.uk/os/vts/sprite')
  })

  test('returns 500 when style file cannot be read', async () => {
    readFile.mockRejectedValue(new Error('ENOENT: no such file'))

    const res = await server.inject({
      method: 'GET',
      url: '/map/style/OS_VTS_27700_Outdoor.json'
    })

    expect(res.statusCode).toBe(statusCodes.internalServerError)
    expect(res.result).toBe('Style file unavailable')
  })

  test('reads the style file once across repeated requests', async () => {
    readFile.mockResolvedValue(JSON.stringify({ sprite: '/os/vts/sprite' }))

    await server.inject({ method: 'GET', url: '/map/style/OS_VTS_27700_Outdoor.json' })
    await server.inject({ method: 'GET', url: '/map/style/OS_VTS_27700_Outdoor.json' })
    await server.inject({ method: 'GET', url: '/map/style/OS_VTS_27700_Outdoor.json' })

    expect(readFile).toHaveBeenCalledTimes(1)
  })

  test('returns 500 when style file contains invalid JSON', async () => {
    readFile.mockResolvedValue('{ not valid json')

    const res = await server.inject({
      method: 'GET',
      url: '/map/style/OS_VTS_27700_Outdoor.json'
    })

    expect(res.statusCode).toBe(statusCodes.internalServerError)
    expect(res.result).toBe('Style file unavailable')
  })
})
