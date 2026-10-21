import { loadGridLayer } from './api.js'

afterEach(() => vi.unstubAllGlobals())

test('adds the grid\'s bands and summary URLs to its map source', async () => {
  const styleConfig = { themes: [{ band: 1 }] }
  const bands = { landCover: { fields: { dominant: { band: 1, classes: [] } } } }
  const fgbs = { 100: '/api/land-model/grid/layer/assets/100.fgb?v=2' }
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ styleConfig, assets: { cog: '/api/land-model/grid/layer/assets/10.tif?v=1', fgbs }, bands })
  })))

  const grid = await loadGridLayer('grid', '/api/land-model/grid/layer')

  expect(grid).toEqual({
    id: 'grid',
    source: expect.objectContaining({ type: 'cog', url: '/api/land-model/grid/layer/assets/10.tif?v=1', styleConfig, bands, fgbs })
  })
  expect(fetch).toHaveBeenCalledWith('/api/land-model/grid/layer', expect.any(Object))
})
