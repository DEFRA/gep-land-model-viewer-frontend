import { vi, describe, test, expect, beforeEach } from 'vitest'

function stubLayer (opts) {
  const properties = opts?.properties || {}
  this._opts = opts
  this.get = vi.fn((key) => properties[key])
}

vi.mock('ol/layer/WebGLVector.js', () => ({
  default: vi.fn().mockImplementation(stubLayer)
}))

vi.mock('ol/source/Vector.js', () => ({
  default: vi.fn().mockImplementation(function (opts) {
    this._opts = opts
    this.setLoader = vi.fn()
  })
}))

vi.mock('flatgeobuf/lib/mjs/ol.js', () => ({
  createLoader: vi.fn(() => 'fgb-loader')
}))

vi.mock('./lyrx-style.js', () => ({
  loadLyrxStyle: vi.fn(async () => ({
    style: { 'fill-color': ['match', ['get', 'A_pred'], 'Bog', '#c29ed7', 'rgba(0, 0, 0, 0)'] },
    maxResolution: 28.109
  }))
}))

vi.mock('./pmtiles-layer.js', () => ({
  createPmtilesLayer: vi.fn(async (url, layerId, options) => {
    const layer = {}
    stubLayer.call(layer, { properties: { id: layerId }, opacity: options.opacity })
    return layer
  })
}))

const { default: WebGLVectorLayer } = await import('ol/layer/WebGLVector.js')
const { default: VectorSource } = await import('ol/source/Vector.js')
const { createLoader } = await import('flatgeobuf/lib/mjs/ol.js')
const { loadLyrxStyle } = await import('./lyrx-style.js')
const { createPmtilesLayer } = await import('./pmtiles-layer.js')
const { createFlatGeobufLayers } = await import('./fgb-layer.js')

const INLINE_STYLE = { 'fill-color': 'rgba(178, 102, 204, 0.42)' }

function fgbDataset (source = {}) {
  return {
    id: 'test-fgb',
    label: 'Test FlatGeobuf',
    source: {
      type: 'fgb',
      url: '/land-model/vector/test.fgb',
      opacity: 0.7,
      ...source
    }
  }
}

describe('#createFlatGeobufLayers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('loads the layer file style and wires a bbox loader', async () => {
    const dataset = fgbDataset({ styleUrl: '/land-model/vector/test.lyrx' })

    const layers = await createFlatGeobufLayers(dataset, 'gep-test-fgb')

    expect(layers).toHaveLength(1)
    expect(createLoader).toHaveBeenCalledWith(
      expect.anything(),
      '/land-model/vector/test.fgb',
      'EPSG:27700',
      expect.any(Function)
    )
    expect(loadLyrxStyle).toHaveBeenCalledWith('/land-model/vector/test.lyrx', { lowercaseFields: false })

    const source = VectorSource.mock.instances[0]
    expect(source.setLoader).toHaveBeenCalledWith('fgb-loader')

    const [layerOptions] = WebGLVectorLayer.mock.calls[0]
    expect(layerOptions.properties).toEqual({ id: 'gep-test-fgb' })
    expect(layerOptions.style['fill-color'][0]).toBe('match')
    expect(layerOptions.maxResolution).toBe(28.109)
    expect(layerOptions.minZoom).toBeUndefined()
    expect(layerOptions.opacity).toBe(0.7)
  })

  test('a dataset with no layer file styles itself inline without fetching one', async () => {
    const dataset = fgbDataset({ minZoom: 7, style: INLINE_STYLE })

    await createFlatGeobufLayers(dataset, 'gep-test-fgb')

    expect(loadLyrxStyle).not.toHaveBeenCalled()

    const [layerOptions] = WebGLVectorLayer.mock.calls[0]
    expect(layerOptions.style).toEqual(INLINE_STYLE)
    expect(layerOptions.maxResolution).toBeUndefined()
    expect(layerOptions.minZoom).toBe(6)
  })

  test('a configured minZoom overrides the layer file minScale', async () => {
    const dataset = fgbDataset({ styleUrl: '/land-model/vector/min-zoom.lyrx', minZoom: 7 })

    await createFlatGeobufLayers(dataset, 'gep-test-fgb')

    // The lyrx mock states maxResolution 28.109, which the configured minZoom
    // replaces outright rather than stacking with. The dataset asks to draw from
    // zoom 7, so OL takes 6.
    const [layerOptions] = WebGLVectorLayer.mock.calls[0]
    expect(layerOptions.maxResolution).toBeUndefined()
    expect(layerOptions.minZoom).toBe(6)
  })

  test('a dataset with neither a layer file nor a minZoom renders at every zoom', async () => {
    const dataset = fgbDataset({ style: INLINE_STYLE })

    await createFlatGeobufLayers(dataset, 'gep-test-fgb')

    const [layerOptions] = WebGLVectorLayer.mock.calls[0]
    expect(layerOptions.maxResolution).toBeUndefined()
    expect(layerOptions.minZoom).toBeUndefined()
  })

  test('an overview adds a second layer and takes the zooms below its max', async () => {
    const dataset = fgbDataset({
      styleUrl: '/land-model/vector/with-overview.lyrx',
      overview: { type: 'pmtiles', url: '/land-model/tiles/with-overview.pmtiles', maxZoom: 4 }
    })

    const layers = await createFlatGeobufLayers(dataset, 'gep-test-fgb')

    expect(layers).toHaveLength(2)

    // The lyrx mock states maxResolution 28.109, which must not cap the detail
    // layer: the overview covers the far zooms instead.
    const [detailOptions] = WebGLVectorLayer.mock.calls[0]
    expect(detailOptions.minZoom).toBe(4)
    expect(detailOptions.maxResolution).toBeUndefined()

    expect(createPmtilesLayer).toHaveBeenCalledWith(
      '/land-model/tiles/with-overview.pmtiles',
      'gep-test-fgb-overview',
      {
        style: detailOptions.style,
        maxZoom: 4,
        opacity: 0.7
      }
    )
  })

  test('an overview without a layer file uses the inline style for both layers', async () => {
    const dataset = fgbDataset({
      style: INLINE_STYLE,
      overview: { type: 'pmtiles', url: '/land-model/tiles/with-overview-inline.pmtiles', maxZoom: 4 }
    })

    await createFlatGeobufLayers(dataset, 'gep-test-fgb')

    expect(loadLyrxStyle).not.toHaveBeenCalled()

    const [detailOptions] = WebGLVectorLayer.mock.calls[0]
    expect(detailOptions.minZoom).toBe(4)

    expect(createPmtilesLayer).toHaveBeenCalledWith(
      '/land-model/tiles/with-overview-inline.pmtiles',
      'gep-test-fgb-overview',
      {
        style: INLINE_STYLE,
        maxZoom: 4,
        opacity: 0.7
      }
    )
  })

  test('an unsupported overview type throws before any layer is built', async () => {
    const dataset = fgbDataset({
      style: INLINE_STYLE,
      overview: { type: 'cog', url: '/land-model/tiles/bad-overview.tif', maxZoom: 4 }
    })

    await expect(createFlatGeobufLayers(dataset, 'gep-test-fgb')).rejects.toThrow(
      'Dataset test-fgb has unsupported overview type "cog", only pmtiles is supported'
    )
    expect(WebGLVectorLayer).not.toHaveBeenCalled()
  })
})
