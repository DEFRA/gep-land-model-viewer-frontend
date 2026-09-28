import { loadDataset, loadDatasetMetadata, loadCatalogue } from './api.js'

afterEach(() => vi.unstubAllGlobals())

function stubDetail (detail) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => detail })))
}

test('returns only the id and map source from the detail request', async () => {
  stubDetail({ id: 'dataset', title: 'Dataset', owner: 'Natural England', display: { assets: { cog: '/a.tif' }, styleConfig: { themes: [{ band: 1 }] } } })

  const dataset = await loadDataset('dataset')

  expect(dataset).toEqual({ id: 'dataset', source: expect.objectContaining({ type: 'cog' }) })
  expect(fetch).toHaveBeenCalledOnce()
  expect(fetch).toHaveBeenCalledWith('/api/datasets/dataset', expect.any(Object))
})

test('rejects map loading when the style config is missing', async () => {
  stubDetail({ id: 'dataset', display: { assets: { cog: '/a.tif' }, styleConfig: null } })

  await expect(loadDataset('dataset')).rejects.toThrow('Missing style config')
})

test('returns metadata without validating map assets or style', async () => {
  stubDetail({ id: 'dataset', owner: 'Natural England', display: { assets: {}, styleConfig: null } })

  await expect(loadDatasetMetadata('dataset')).resolves.toEqual({ id: 'dataset', owner: 'Natural England' })
})

test('asks for JSON and passes the abort signal', async () => {
  stubDetail({ results: [], total: 0 })
  const signal = new AbortController().signal

  await loadCatalogue('peat', signal)

  const [url, init] = fetch.mock.calls[0]
  expect(url).toBe('/api/datasets?q=peat')
  expect(init.signal).toBe(signal)
  expect(init.headers.get('accept')).toBe('application/json')
})
