// @vitest-environment jsdom
import { render } from '@testing-library/preact'
import { useCatalogue } from './use-catalogue.js'

function Catalogue ({ query = '', dispatch }) {
  useCatalogue({ catalogue: { query, attempt: 0 }, dispatch })
  return null
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('ignores stale searches and cancels requests when the catalogue unmounts', async () => {
  const requests = []
  vi.stubGlobal('fetch', vi.fn((url, options) => new Promise(resolve => requests.push({ url, options, resolve }))))
  const dispatch = vi.fn()
  const view = render(<Catalogue dispatch={dispatch} />)
  await vi.waitFor(() => expect(requests).toHaveLength(1))

  view.rerender(<Catalogue query='peat' dispatch={dispatch} />)
  await vi.waitFor(() => expect(requests).toHaveLength(2))
  expect(requests[0].options.signal.aborted).toBe(true)
  expect(requests[1].url).toBe('/api/datasets?q=peat')

  requests[0].resolve({ ok: true, json: async () => ({ results: [{ id: 'stale' }] }) })
  requests[1].resolve({ ok: true, json: async () => ({ results: [{ id: 'peat' }], total: 1 }) })
  await vi.waitFor(() => expect(dispatch).toHaveBeenCalledWith({ type: 'CATALOGUE_LOADED', payload: { results: [{ id: 'peat' }], total: 1, query: 'peat' } }))
  expect(dispatch.mock.calls.filter(([action]) => action.type === 'CATALOGUE_LOADED')).toHaveLength(1)

  view.unmount()
  expect(requests[1].options.signal.aborted).toBe(true)
})

test('reports an API failure instead of leaving the catalogue loading', async () => {
  const logError = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 502 })))
  const dispatch = vi.fn()
  render(<Catalogue dispatch={dispatch} />)

  await vi.waitFor(() => expect(dispatch).toHaveBeenCalledWith({ type: 'CATALOGUE_FAILED', payload: { query: '' } }))
  expect(logError).toHaveBeenCalledWith('Failed to load dataset catalogue', expect.any(Error))
})
