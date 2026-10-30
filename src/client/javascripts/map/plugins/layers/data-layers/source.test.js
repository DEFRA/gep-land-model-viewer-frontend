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

test.each([
  { styleConfig: {}, assets: { cog: '/peat.tif' }, message: 'Missing style themes' },
  { styleConfig: { themes: [] }, assets: { cog: '/peat.tif' }, message: 'Missing style themes' },
  { styleConfig: { themes: [{ band: 1 }] }, assets: {}, message: 'Missing map data' }
])('names what is missing: $message', ({ styleConfig, assets, message }) => {
  expect(() => sourceFor(styleConfig, assets)).toThrow(message)
})
