import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { brotliDecompressSync } from 'node:zlib'
import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'

const parcelsUrl = '/land-model/parcels.json'

describe('#landModel', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('serves brotli-compressed JSON from the static directory', async () => {
    const { rawPayload, statusCode, headers } = await server.inject({
      method: 'GET',
      url: parcelsUrl,
      headers: {
        'accept-encoding': 'br'
      }
    })

    const json = brotliDecompressSync(rawPayload).toString()

    expect(statusCode).toBe(statusCodes.ok)
    expect(headers['content-type']).toMatch(/application\/json/)
    expect(headers['content-encoding']).toBe('br')
    expect(json).toMatch(/^\[\{"osid":/)
  })

  test('caches privately but revalidates each request', async () => {
    const { headers } = await server.inject({
      method: 'GET',
      url: parcelsUrl,
      headers: {
        'accept-encoding': 'br'
      }
    })

    expect(headers['cache-control']).toBe('private, no-cache')
  })

  test('returns 404 for a file not in the allowlist', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/land-model/does-not-exist.json'
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })
})
