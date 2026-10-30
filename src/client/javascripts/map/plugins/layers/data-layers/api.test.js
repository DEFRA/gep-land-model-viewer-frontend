import { loadLayer } from './api.js'

afterEach(() => vi.unstubAllGlobals())

function stubResponse (body) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => body })))
}

test('builds the map source from the dataset layer response', async () => {
  const styleConfig = { themes: [{ band: 1, classes: [{ fill: [0, 0, 0, 1] }] }] }
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
