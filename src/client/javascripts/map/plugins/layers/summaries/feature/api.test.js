import { loadFeatureLayer } from './api.js'

afterEach(() => vi.unstubAllGlobals())

test('adds the release\'s data sources to the OS features\' map source', async () => {
  const styleConfig = { themes: [{ band: 1 }] }
  const dataSources = { land_use: { name: 'OS NGD' } }
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ styleConfig, assets: { fgb: '/api/land-model/parcels/layer/assets/data.fgb?v=1' }, dataSources })
  })))

  const features = await loadFeatureLayer('features', '/api/land-model/parcels/layer')

  expect(features).toEqual({
    id: 'features',
    source: expect.objectContaining({ type: 'fgb', url: '/api/land-model/parcels/layer/assets/data.fgb?v=1', styleConfig, dataSources })
  })
  expect(fetch).toHaveBeenCalledWith('/api/land-model/parcels/layer', expect.any(Object))
})
