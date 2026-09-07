import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { mockAuthCredentials } from '../common/test-helpers/auth.js'

describe('#mapController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('renders the map page', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/',
      auth: mockAuthCredentials
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Map |'))
    expect(result).toEqual(expect.stringContaining('id="land-map"'))
  })

  test('applies map CSP for dataset hosts, blob workers and runtime styles', async () => {
    const mapResp = await server.inject({ method: 'GET', url: '/', auth: mockAuthCredentials })
    const mapCsp = mapResp.headers['content-security-policy']
    const styleNonce = mapResp.result.match(/<main[^>]+data-style-nonce="([^"]+)"/)?.[1]
    const styleSource = mapCsp.split(';').find(directive => directive.trim().startsWith('style-src '))
    expect(mapCsp).toContain('https://environment.data.gov.uk')
    expect(mapCsp).toContain('https://gepcloudnativedata.blob.core.windows.net')
    expect(mapCsp).toContain('blob:')
    expect(styleSource).toContain(`'nonce-${styleNonce}'`)

    const cookiesResp = await server.inject({ method: 'GET', url: '/cookies', auth: mockAuthCredentials })
    const cookiesCsp = cookiesResp.headers['content-security-policy']
    expect(cookiesCsp).not.toContain('https://environment.data.gov.uk')
  })
})
