import { runInNewContext } from 'node:vm'
import { load } from 'cheerio'
import { config } from '../../config/config.js'
import { mockAuthCredentials } from '../common/test-helpers/auth.js'

const cookieName = config.get('cookieConsent.name')
const policy = (analytics, confirmed = true) => `${cookieName}=${Buffer.from(JSON.stringify({ essential: true, confirmed, analytics })).toString('base64')}`
const cookieHeader = (response) => response.headers['set-cookie'].map((value) => value.split(';')[0]).join('; ')

function readPolicy (response) {
  const value = response.headers['set-cookie'].find((cookie) => cookie.startsWith(`${cookieName}=`)).split(';')[0].slice(cookieName.length + 1)
  return JSON.parse(Buffer.from(value, 'base64').toString())
}

describe('cookie consent integration', () => {
  let server
  beforeAll(async () => {
    vi.stubEnv('GOOGLE_TAG_MANAGER_KEY', 'GTM-TEST123')
    vi.resetModules()
    const { createServer } = await import('../server.js')
    server = await createServer()
    await server.initialize()
  })
  afterAll(async () => {
    await server.stop({ timeout: 0 })
    vi.unstubAllEnvs()
  })

  async function submit (payload, extraCookies = '') {
    const page = await server.inject({ url: '/cookies', auth: mockAuthCredentials })
    const $ = load(page.payload)
    return server.inject({
      method: 'POST',
      url: '/cookies',
      auth: mockAuthCredentials,
      headers: { cookie: cookieHeader(page) + extraCookies },
      payload: { crumb: $('input[name="crumb"]').val(), ...payload }
    })
  }

  test('first visit sets a default policy and shows the banner without GTM', async () => {
    const response = await server.inject({ url: '/', auth: mockAuthCredentials })
    expect(response.statusCode).toBe(200)
    expect(readPolicy(response)).toEqual({ essential: true, confirmed: false, analytics: false })
    const $ = load(response.payload)
    expect($('.js-cookies-container')).toHaveLength(1)
    expect($('.js-cookies-container').attr('data-crumb')).toBeTruthy()
    expect($('input[name="returnUrl"]').val()).toBe('/')
    expect($('script:not([src])').text()).not.toContain('gtm.start')
    expect($('iframe')).toHaveLength(0)
  })

  test.each([true, false])('async choice %s is persisted by the server', async (analytics) => {
    const response = await submit({ analytics, async: true })
    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual({ message: 'success' })
    expect(readPolicy(response)).toEqual({ essential: true, confirmed: true, analytics })
    const cookie = response.headers['set-cookie'].find((value) => value.startsWith(`${cookieName}=`))
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Max-Age=31536000')
    expect(cookie).toContain('Path=/')
  })

  test('native banner form returns to the original URL with its query intact', async () => {
    const page = await server.inject({ url: '/?q=water&sort=titleAsc', auth: mockAuthCredentials })
    expect(load(page.payload)('input[name="returnUrl"]').val()).toBe('/?q=water&sort=titleAsc')
    const response = await submit({ analytics: 'true', async: 'false', returnUrl: '/?q=water&sort=titleAsc' })
    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/?q=water&sort=titleAsc')
    expect(readPolicy(response).analytics).toBe(true)
  })

  test.each(['https://evil.com', '//evil.com', '/.//evil.com', '/\\evil.com'])('rejects unsafe return URL %s', async (returnUrl) => {
    const response = await submit({ analytics: false, returnUrl })
    expect(response.headers.location).toBe('/')
  })

  test('preference form redirects to the saved message', async () => {
    const response = await submit({ analytics: 'false', async: 'false' })
    expect(response.headers.location).toBe('/cookies?saved=true')
    const page = await server.inject({ url: response.headers.location, auth: mockAuthCredentials, headers: { cookie: cookieHeader(response) } })
    expect(page.payload).toContain('Your cookie settings were saved')
  })

  test.each(['/', '/cookies'])('accepted consent loads GTM with a CSP nonce on %s', async (url) => {
    const response = await server.inject({ url, auth: mockAuthCredentials, headers: { cookie: policy(true) } })
    const $ = load(response.payload)
    const script = $('script').filter((_, el) => $(el).text().includes('gtm.start'))
    expect(script).toHaveLength(1)
    expect(script.text()).toContain('GTM-TEST123')
    expect(response.headers['content-security-policy']).toContain(`'nonce-${script.attr('nonce')}'`)
    expect($('noscript').html()).toContain('https://www.googletagmanager.com/ns.html?id=GTM-TEST123')
    expect($('.js-cookies-container')).toHaveLength(0)
    expect(response.headers['cache-control']).toContain('no-store')
  })

  test('rejected consent omits GTM and expires all analytics cookie families', async () => {
    const analyticsCookies = '; _ga=a; _ga_ABC=b; _gid=c; _gat=d; _gat_ABC=e; _dc_gtm_ABC=f; unrelated=keep'
    const response = await submit({ analytics: false, async: true }, analyticsCookies)
    const expired = response.headers['set-cookie'].filter((value) => value.includes('Max-Age=0'))
    expect(expired).toHaveLength(6)
    expect(expired.join(';')).not.toContain('unrelated')
    const page = await server.inject({ url: '/', auth: mockAuthCredentials, headers: { cookie: policy(false) + analyticsCookies } })
    expect(page.payload).not.toContain('gtm.start')
    expect(page.headers['set-cookie'].filter((value) => value.includes('Max-Age=0'))).toHaveLength(6)
  })

  test('unconfirmed visits do not remove shared analytics cookies server-side', async () => {
    const response = await server.inject({ url: '/', auth: mockAuthCredentials, headers: { cookie: '_ga=shared' } })
    expect(response.headers['set-cookie'].join(';')).not.toContain('_ga=')
  })

  test('unconfirmed analytics preference does not load GTM', async () => {
    const response = await server.inject({ url: '/', auth: mockAuthCredentials, headers: { cookie: policy(true, false) } })
    expect(response.payload).not.toContain('gtm.start')
    expect(load(response.payload)('.js-cookies-container')).toHaveLength(1)
  })

  test('shared legacy cookies do not grant consent for this service', async () => {
    const legacy = `defra_cookies_policy=${encodeURIComponent(JSON.stringify({ analytics: true }))}; defra_cookies_policy_set=true`
    const response = await server.inject({ url: '/', auth: mockAuthCredentials, headers: { cookie: legacy } })
    expect(response.payload).not.toContain('gtm.start')
    expect(readPolicy(response).confirmed).toBe(false)
    expect(load(response.payload)('.js-cookies-container')).toHaveLength(1)
  })

  test.each(['bad-json', Buffer.from('null').toString('base64'), Buffer.from('{"analytics":"true"}').toString('base64')])('invalid policy resets consent safely: %s', async (value) => {
    const response = await server.inject({ url: '/', auth: mockAuthCredentials, headers: { cookie: `${cookieName}=${value}` } })
    expect(response.statusCode).toBe(200)
    expect(response.payload).not.toContain('gtm.start')
    expect(readPolicy(response).confirmed).toBe(false)
  })

  test('cookie page renders the preference and hides the banner', async () => {
    const response = await server.inject({ url: '/cookies', auth: mockAuthCredentials, headers: { cookie: policy(true) } })
    const $ = load(response.payload)
    expect($('input[name="analytics"]:checked').val()).toBe('true')
    expect($('.js-cookies-container')).toHaveLength(0)
    expect(response.payload).toContain(cookieName)
    expect(response.payload).not.toContain('Your cookie settings were saved')
  })

  test.each([undefined, false, true])('queues consent defaults before GTM for analytics preference %s', async (analytics) => {
    const response = await server.inject({
      url: '/',
      auth: mockAuthCredentials,
      headers: analytics === undefined ? {} : { cookie: policy(analytics) }
    })
    const $ = load(response.payload)
    const consent = $('script').filter((_, el) => $(el).text().includes("gtag('consent', 'default'"))
    expect(consent).toHaveLength(1)
    expect(response.headers['content-security-policy']).toContain(`'nonce-${consent.attr('nonce')}'`)
    const sandbox = { window: {} }
    sandbox.window = sandbox
    runInNewContext(consent.text(), sandbox)
    const commands = sandbox.dataLayer.map((args) => Array.from(args))
    const denied = {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    }
    expect(commands[0]).toEqual(['consent', 'default', denied])
    if (analytics) {
      expect(commands[1]).toEqual(['consent', 'update', { ...denied, analytics_storage: 'granted' }])
      expect(response.payload.indexOf("gtag('consent', 'default'")).toBeLessThan(response.payload.indexOf('gtm.start'))
    } else {
      expect(commands).toHaveLength(1)
      expect(response.payload).not.toContain('gtm.start')
    }
  })

  test('CSRF token is required', async () => {
    const response = await server.inject({ method: 'POST', url: '/cookies', auth: mockAuthCredentials, payload: { analytics: true, async: true } })
    expect(response.statusCode).toBe(403)
  })

  test.each([{}, { analytics: 'yes' }, { analytics: true, async: 'invalid' }])('invalid payload cannot save consent: %j', async (payload) => {
    const response = await submit(payload)
    expect(response.statusCode).toBe(400)
  })
})
