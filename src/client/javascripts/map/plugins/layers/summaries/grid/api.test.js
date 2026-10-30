import { loadGridLayer } from './api.js'

afterEach(() => vi.unstubAllGlobals())

test('adds the grid\'s bands, data sources and summary URLs to its map source', async () => {
  const styleConfig = { themes: [{ band: 1 }] }
  const bands = { land_cover_dominant_value: { band: 1, classes: [] } }
  const dataSources = { land_cover: { name: 'UKCEH Land Cover Map' } }
  const fgbs = { 100: '/api/land-model/grid/layer/assets/100.fgb?v=2' }
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ styleConfig, assets: { cog: '/api/land-model/grid/layer/assets/10.tif?v=1', fgbs }, bands, dataSources })
  })))

  const grid = await loadGridLayer('grid', '/api/land-model/grid/layer')

  expect(grid).toEqual({
    id: 'grid',
    source: expect.objectContaining({ type: 'cog', url: '/api/land-model/grid/layer/assets/10.tif?v=1', styleConfig, bands, fgbs, dataSources })
  })
  expect(fetch).toHaveBeenCalledWith('/api/land-model/grid/layer', expect.any(Object))
})
