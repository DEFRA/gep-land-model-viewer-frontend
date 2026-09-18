import { vi } from 'vitest'
import Hapi from '@hapi/hapi'
import Scooter from '@hapi/scooter'
import { createServer } from '../../server.js'

describe('#contentSecurityPolicy', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should set the CSP policy header', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    const csp = resp.headers['content-security-policy']
    expect(csp).toBeDefined()
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("form-action 'self'")
  })

  test('Should generate a script nonce', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    const csp = resp.headers['content-security-policy']
    expect(csp).toMatch(/script-src 'self' 'nonce-[a-f0-9]+'/)
  })

  test('Should not relax script-src or worker-src on non-map routes', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/cookies'
    })

    const csp = resp.headers['content-security-policy']
    expect(csp).not.toContain("'unsafe-eval'")
    expect(csp).not.toContain("'wasm-unsafe-eval'")
    expect(csp).not.toContain('blob:')
    expect(csp).not.toContain('environment.data.gov.uk')
  })

  test('Should not include GTM domains when container ID is not set', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    const csp = resp.headers['content-security-policy']
    expect(csp).not.toContain('googletagmanager.com')
    expect(csp).not.toContain('google-analytics.com')
  })
})

describe('#contentSecurityPolicy with GTM', () => {
  let server

  beforeAll(async () => {
    vi.stubEnv('GTM_CONTAINER_ID', 'GTM-TEST123')
    vi.resetModules()

    const { createServer: createGtmServer } = await import('../../server.js')
    server = await createGtmServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
    vi.unstubAllEnvs()
  })

  test('Should include GTM domains in script-src', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    const csp = resp.headers['content-security-policy']
    expect(csp).toContain('https://www.googletagmanager.com')
    expect(csp).toContain('https://www.google-analytics.com')
  })

  test('Should include analytics domains in connect-src', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    const csp = resp.headers['content-security-policy']
    expect(csp).toContain('https://analytics.google.com')
    expect(csp).toContain('https://region1.google-analytics.com')
  })

  test('Should include GTM domain in frame-src', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    const csp = resp.headers['content-security-policy']
    expect(csp).toMatch(/frame-src 'self' https:\/\/www\.googletagmanager\.com/)
  })
})

describe.each(['development', 'production'])('#contentSecurityPolicy in %s', (nodeEnv) => {
  let server

  beforeAll(async () => {
    vi.stubEnv('NODE_ENV', nodeEnv)
    vi.resetModules()

    const { contentSecurityPolicy, mapContentSecurityPolicy } = await import('./content-security-policy.js')
    server = Hapi.server()
    await server.register([Scooter, contentSecurityPolicy])
    server.route([
      { method: 'GET', path: '/plain', handler: () => 'Page' },
      {
        method: 'GET',
        path: '/map',
        options: { plugins: { blankie: mapContentSecurityPolicy } },
        handler: () => 'Map'
      }
    ])
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  test.each(['/plain', '/map'])('only allows local WebSockets on %s in development', async (url) => {
    const { headers } = await server.inject(url)
    const csp = headers['content-security-policy']
    const connectSrc = csp.split(';').find(directive => directive.trim().startsWith('connect-src '))

    if (nodeEnv === 'development') {
      expect(connectSrc).toContain('ws://localhost:*')
      expect(connectSrc).toContain('ws://127.0.0.1:*')
    } else {
      expect(connectSrc).not.toMatch(/wss?:/)
    }
  })
})
