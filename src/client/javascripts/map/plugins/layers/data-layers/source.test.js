import { sourceFor } from './source.js'

test.each([
  { assets: { cog: '/peat.tif' }, expected: { type: 'cog', url: '/peat.tif' } },
  { assets: { fgb: '/trees.fgb' }, expected: { type: 'fgb', url: '/trees.fgb', minZoom: 7 } },
  { assets: { fgb: '/trees.fgb', cog: '/trees.tif' }, expected: { type: 'fgb', minZoom: 7, overview: { type: 'cog', url: '/trees.tif' } } }
])('uses the available formats and a shared FGB zoom floor: $assets', ({ assets, expected }) => {
  const styleConfig = { themes: [{ band: 1, classes: [{ fill: [0, 0, 0, 1] }] }] }
  const source = sourceFor(styleConfig, assets)

  expect(source).toMatchObject({ ...expected, styleConfig, opacity: 0.5 })
  if (!assets.fgb) {
    expect(source.minZoom).toBeUndefined()
  }
})

test('an outline-only FlatGeobuf has no COG overview', () => {
  const styleConfig = { themes: [{ band: 1, classes: [{ stroke: { color: [0, 0, 0, 1], width: 2 } }] }] }
  const source = sourceFor(styleConfig, { fgb: '/trees.fgb', cog: '/trees.tif' })

  expect(source).toMatchObject({ type: 'fgb', url: '/trees.fgb', minZoom: 7 })
  expect(source.overview).toBeUndefined()
})

test('takes the default opacity from the style config when it sets one', () => {
  const source = sourceFor({ opacity: 0.01, themes: [{ band: 1 }] }, { cog: '/grid.tif' })

  expect(source.opacity).toBe(0.01)
})

test('makes visible class fills opaque so only layer opacity sets transparency', () => {
  const stroke = { color: [0, 0, 255, 0.4], width: 2 }
  const styleConfig = {
    opacity: 0.3,
    themes: [{
      band: 1,
      classes: [{ fill: [96, 165, 250, 0.5] }, { fill: [0, 0, 0, 0], stroke }],
      default: { fill: [255, 0, 0, 0.6] }
    }]
  }
  const source = sourceFor(styleConfig, { cog: '/parcels.tif' })

  expect(source.opacity).toBe(0.3)
  expect(source.styleConfig.themes[0].classes).toEqual([{ fill: [96, 165, 250, 1] }, { fill: [0, 0, 0, 0], stroke }])
  expect(source.styleConfig.themes[0].default).toEqual({ fill: [255, 0, 0, 1] })
  expect(styleConfig.themes[0].classes[0].fill).toEqual([96, 165, 250, 0.5])
})

test.each([
  { styleConfig: {}, assets: { cog: '/peat.tif' }, message: 'Missing style themes' },
  { styleConfig: { themes: [] }, assets: { cog: '/peat.tif' }, message: 'Missing style themes' },
  { styleConfig: { themes: [{ band: 1 }] }, assets: {}, message: 'Missing map data' }
])('names what is missing: $message', ({ styleConfig, assets, message }) => {
  expect(() => sourceFor(styleConfig, assets)).toThrow(message)
})
