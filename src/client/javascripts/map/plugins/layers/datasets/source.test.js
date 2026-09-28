import { sourceFor } from './source.js'

test.each([
  { assets: { cog: '/peat.tif' }, expected: { type: 'cog', url: '/peat.tif' } },
  { assets: { fgb: '/trees.fgb' }, expected: { type: 'fgb', url: '/trees.fgb', minZoom: 7 } },
  { assets: { fgb: '/trees.fgb', cog: '/trees.tif' }, expected: { type: 'fgb', minZoom: 7, overview: { type: 'cog', url: '/trees.tif' } } }
])('uses the available formats and a shared FGB zoom floor: $assets', ({ assets, expected }) => {
  const styleConfig = { themes: [{ band: 1 }] }
  const source = sourceFor(styleConfig, assets)

  expect(source).toMatchObject({ ...expected, styleConfig, opacity: 0.5 })
  if (!assets.fgb) {
    expect(source.minZoom).toBeUndefined()
  }
})

test.each([
  { styleConfig: null, assets: { cog: '/peat.tif' }, message: 'Missing style config' },
  { styleConfig: {}, assets: { cog: '/peat.tif' }, message: 'Missing style themes' },
  { styleConfig: { themes: [] }, assets: { cog: '/peat.tif' }, message: 'Missing style themes' },
  { styleConfig: { themes: [{ band: 1 }] }, assets: {}, message: 'Missing map data' }
])('names what is missing: $message', ({ styleConfig, assets, message }) => {
  expect(() => sourceFor(styleConfig, assets)).toThrow(message)
})
