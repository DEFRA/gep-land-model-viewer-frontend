import { loadDatasetMetadata, loadCatalogue } from './api.js'

afterEach(() => vi.unstubAllGlobals())

function stubResponse (body) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => body })))
}

test('returns the metadata response body', async () => {
  const metadata = { id: 'dataset', title: 'Dataset', owner: 'Natural England' }
  stubResponse(metadata)

  await expect(loadDatasetMetadata('dataset')).resolves.toEqual(metadata)
  expect(fetch).toHaveBeenCalledWith('/api/datasets/dataset', expect.any(Object))
})

test('asks for JSON and passes the abort signal', async () => {
  stubResponse({ results: [], total: 0 })
  const signal = new AbortController().signal

  await loadCatalogue('peat', signal)

  const [url, init] = fetch.mock.calls[0]
  expect(url).toBe('/api/datasets?q=peat')
  expect(init.signal).toBe(signal)
  expect(init.headers.get('accept')).toBe('application/json')
})
