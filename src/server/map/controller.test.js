import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'

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
      url: '/map'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Map |'))
    expect(result).toEqual(expect.stringContaining('id="land-map"'))
  })

  test('applies map CSP with EA data host and blob workers on the map route', async () => {
    const mapResp = await server.inject({ method: 'GET', url: '/map' })
    const mapCsp = mapResp.headers['content-security-policy']
    expect(mapCsp).toContain('https://environment.data.gov.uk')
    expect(mapCsp).toContain('blob:')

    const homeResp = await server.inject({ method: 'GET', url: '/' })
    const homeCsp = homeResp.headers['content-security-policy']
    expect(homeCsp).not.toContain('https://environment.data.gov.uk')
  })
})
