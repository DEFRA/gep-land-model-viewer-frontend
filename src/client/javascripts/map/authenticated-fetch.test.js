import { describe, test, expect, vi, afterEach } from 'vitest'
import { authenticatedFetch } from './authenticated-fetch.js'

describe('#authenticatedFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('returns the response when status is ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true }))

    const res = await authenticatedFetch('/api/data')

    expect(res.status).toBe(200)
    expect(fetch).toHaveBeenCalledWith('/api/data', expect.objectContaining({
      headers: expect.any(Headers)
    }))
  })

  test('reloads the page on 401 and never resolves', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401, ok: false }))
    const reload = vi.fn()
    vi.stubGlobal('location', { reload })

    let resolved = false
    const pending = authenticatedFetch('/api/data').then(() => { resolved = true })
    await Promise.resolve()

    expect(reload).toHaveBeenCalled()
    expect(resolved).toBe(false)

    pending.catch(() => {})
  })

  test('does not reload on non-401 error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 500, ok: false }))
    const reload = vi.fn()
    vi.stubGlobal('location', { reload })

    const res = await authenticatedFetch('/api/data')

    expect(res.status).toBe(500)
    expect(reload).not.toHaveBeenCalled()
  })

  test('passes init options through to fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true }))
    const signal = AbortSignal.abort()

    await authenticatedFetch('/api/data', { signal })

    expect(fetch).toHaveBeenCalledWith('/api/data', expect.objectContaining({ signal }))
  })

  test('sets Accept application/json header by default', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true }))

    await authenticatedFetch('/api/data')

    const headers = fetch.mock.calls[0][1].headers
    expect(headers.get('Accept')).toBe('application/json')
  })

  test('does not override an existing Accept header', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true }))

    await authenticatedFetch('/api/data', {
      headers: { Accept: 'text/plain' }
    })

    const headers = fetch.mock.calls[0][1].headers
    expect(headers.get('Accept')).toBe('text/plain')
  })
})
