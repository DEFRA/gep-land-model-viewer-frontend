import { loadLayer } from './api.js'
import { matchThemeFieldsToFgbColumns } from './layers/fgb-columns.js'

const { matchedStyleConfig } = vi.hoisted(() => ({
  matchedStyleConfig: { themes: [{ band: 1, field: 'themname' }] }
}))

vi.mock('./layers/fgb-columns.js', () => ({
  matchThemeFieldsToFgbColumns: vi.fn(async (source) => ({ ...source, styleConfig: matchedStyleConfig }))
}))

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

  expect(matchThemeFieldsToFgbColumns).toHaveBeenCalledWith(expect.objectContaining({ styleConfig }))
  expect(dataset).toEqual({
    id: 'dataset',
    source: expect.objectContaining({
      type: 'fgb',
      url: assets.fgb,
      styleConfig: matchedStyleConfig,
      overview: { type: 'cog', url: assets.cog }
    })
  })
  expect(fetch).toHaveBeenCalledOnce()
  expect(fetch).toHaveBeenCalledWith('/api/datasets/dataset/layer', expect.any(Object))
})

test('does not read FlatGeobuf columns for a COG-only layer', async () => {
  const styleConfig = { themes: [{ band: 1, classes: [{ fill: [0, 0, 0, 1] }] }] }
  stubResponse({ styleConfig, assets: { cog: '/api/datasets/dataset/layer/assets/data.tif' } })

  await loadLayer('dataset', '/api/datasets/dataset/layer')

  expect(matchThemeFieldsToFgbColumns).not.toHaveBeenCalled()
})

test('rejects map loading when the layer request fails', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })))

  await expect(loadLayer('dataset', '/api/datasets/dataset/layer')).rejects.toThrow('Request failed (500)')
})
