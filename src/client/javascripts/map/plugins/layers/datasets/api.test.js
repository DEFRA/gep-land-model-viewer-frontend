import { loadLayer, loadDatasetMetadata, loadCatalogue } from './api.js'

afterEach(() => vi.unstubAllGlobals())

function stubResponse (body) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => body })))
}

test('builds the map source from the dataset layer response', async () => {
  const styleConfig = { themes: [{ band: 1 }] }
  const assets = {
    cog: '/api/datasets/dataset/layer/assets/data.tif?v=3%2FL4kqtJlcpXroDTDmJ%2BrmSpXd3dIbrHY',
    fgb: '/api/datasets/dataset/layer/assets/data.fgb?v=fgb-version'
  }
  stubResponse({ manifestVersion: 'manifest-version', generatedAt: '2026-10-08T14:52:12.304Z', styleConfig, assets })

  const dataset = await loadLayer('dataset', '/api/datasets/dataset/layer')

  expect(dataset).toEqual({
    id: 'dataset',
    source: expect.objectContaining({ type: 'fgb', url: assets.fgb, styleConfig, overview: { type: 'cog', url: assets.cog } })
  })
  expect(fetch).toHaveBeenCalledOnce()
  expect(fetch).toHaveBeenCalledWith('/api/datasets/dataset/layer', expect.any(Object))
})

test('rejects map loading when the layer request fails', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })))

  await expect(loadLayer('dataset', '/api/datasets/dataset/layer')).rejects.toThrow('Request failed (500)')
})

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
