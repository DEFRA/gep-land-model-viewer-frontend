import { getLayerStyle } from '../layer-style.js'
import { THEMED_DATASET } from '../test-helpers/themed-dataset.js'
import { vi, describe, test, expect, beforeEach } from 'vitest'

function stubGeoTiffSource (opts) {
  const listeners = new Set()
  let state = 'ready'
  let error = null
  this._opts = opts
  this.getView = vi.fn(() => Promise.resolve({}))
  this.getState = vi.fn(() => state)
  this.getError = vi.fn(() => error)
  this.on = vi.fn((type, listener) => listeners.add(listener))
  this.un = vi.fn((type, listener) => listeners.delete(listener))
  this._fail = (nextError) => {
    error = nextError
    state = 'error'
    for (const listener of [...listeners]) {
      listener()
    }
  }
}

vi.mock('ol/source/GeoTIFF.js', () => ({
  default: vi.fn().mockImplementation(stubGeoTiffSource)
}))

vi.mock('ol/layer/WebGLTile.js', () => ({
  default: vi.fn().mockImplementation(function (opts) {
    this._opts = opts
    this.setStyle = vi.fn()
    this.setOpacity = vi.fn()
  })
}))

vi.mock('../style-config.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, buildCogColourExpression: vi.fn(actual.buildCogColourExpression) }
})

const { default: GeoTIFF } = await import('ol/source/GeoTIFF.js')
const { default: WebGLTileLayer } = await import('ol/layer/WebGLTile.js')
const { buildCogColourExpression } = await import('../style-config.js')
const { createCogLayer, createCogOverviewLayer } = await import('./cog.js')

const SOURCE_VALUE_RANGE_STYLE = {
  label: 'Soil depth',
  type: 'range',
  band: 1,
  minValue: 0,
  classes: [{ maxValue: 20, label: 'Up to 20cm', fill: [204, 204, 255, 1] }],
  default: { label: 'Over 20cm', fill: [0, 0, 224, 1] }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('#createCogLayer', () => {
  test('renders the selected band and switches themes without recreating the source', async () => {
    const dataset = {
      ...THEMED_DATASET,
      source: { ...THEMED_DATASET.source, type: 'cog', url: '/multi-band.tif', normalize: false, interpolate: false }
    }

    const datasetLayer = await createCogLayer(dataset, 'gep-multi-band', getLayerStyle(dataset, { themeBand: 2 }))
    const [layer] = datasetLayer.layers

    expect(GeoTIFF.mock.calls[0][0].sources).toEqual([{ url: '/multi-band.tif' }])
    expect(layer._opts.style.color).toEqual([
      'case', ['==', ['band', 2], 1], [66, 135, 245, 1], [0, 0, 0, 0]
    ])
    datasetLayer.applyStyle(getLayerStyle(dataset, { themeBand: 1 }).styleConfig)
    expect(layer.setStyle).toHaveBeenLastCalledWith({
      color: ['case', ['==', ['band', 1], 1], [112, 38, 1, 1], [0, 0, 0, 0]]
    })
    expect(GeoTIFF).toHaveBeenCalledOnce()
  })

  test('creates a WebGL tile layer styled from a source-value range config', async () => {
    const dataset = {
      id: 'test-cog',
      source: {
        type: 'cog',
        url: '/land-model/raster/test.tif',
        opacity: 0.8,
        normalize: false,
        interpolate: false,
        styleConfig: { themes: [SOURCE_VALUE_RANGE_STYLE] }
      }
    }

    const datasetLayer = await createCogLayer(dataset, 'gep-test-cog', getLayerStyle(dataset))

    expect(GeoTIFF).toHaveBeenCalledWith({
      sources: [{ url: '/land-model/raster/test.tif' }],
      normalize: false,
      interpolate: false
    })

    expect(buildCogColourExpression).toHaveBeenCalledWith(SOURCE_VALUE_RANGE_STYLE)
    const [layerOptions] = WebGLTileLayer.mock.calls[0]
    expect(layerOptions.properties).toEqual({ id: 'gep-test-cog' })
    expect(layerOptions.opacity).toBe(0.8)
    expect(layerOptions.style.color).toEqual(buildCogColourExpression.mock.results[0].value)

    const updatedStyle = { ...SOURCE_VALUE_RANGE_STYLE, default: { label: 'Over 20cm', fill: [255, 0, 0, 1] } }
    datasetLayer.applyStyle(updatedStyle)
    datasetLayer.setOpacity(0.4)

    const [layer] = datasetLayer.layers
    expect(buildCogColourExpression).toHaveBeenLastCalledWith(updatedStyle)
    expect(layer.setStyle).toHaveBeenCalledWith({ color: buildCogColourExpression.mock.results.at(-1).value })
    expect(layer.setOpacity).toHaveBeenCalledWith(0.4)
    expect(GeoTIFF).toHaveBeenCalledOnce()
    expect(WebGLTileLayer).toHaveBeenCalledOnce()
  })
})

describe('#createCogOverviewLayer', () => {
  const styleConfig = {
    label: 'Habitat',
    type: 'match',
    band: 1,
    field: 'category',
    classes: [{ bandValue: 1, fieldValues: ['Bog'], label: 'Bog', fill: [194, 158, 215, 1] }]
  }

  test('creates an unbounded raster underlay styled from the config', async () => {
    const overview = { type: 'cog', url: '/land-model/raster/overview.tif' }

    await createCogOverviewLayer(overview, 'gep-test-fgb-overview', {
      styleConfig,
      className: 'ol-layer gep-test-fgb-composite'
    })

    expect(GeoTIFF).toHaveBeenCalledWith({
      sources: [{ url: '/land-model/raster/overview.tif' }],
      normalize: false,
      interpolate: false,
      wrapX: false,
      projection: 'EPSG:27700',
      transition: 0
    })

    const source = GeoTIFF.mock.instances.at(-1)
    expect(source.getView).toHaveBeenCalled()

    expect(buildCogColourExpression).toHaveBeenCalledWith(styleConfig)
    const [layerOptions] = WebGLTileLayer.mock.calls.at(-1)
    expect(layerOptions.properties).toEqual({ id: 'gep-test-fgb-overview' })
    expect(layerOptions.opacity).toBe(1)
    expect(layerOptions.className).toBe('ol-layer gep-test-fgb-composite')
    expect(layerOptions.style.color).toEqual(buildCogColourExpression.mock.results.at(-1).value)
    expect(layerOptions.minZoom).toBeUndefined()
    expect(layerOptions.maxZoom).toBeUndefined()
    expect(layerOptions.preload).toBe(Infinity)
  })

  test('rejects when the COG source errors while getView remains pending', async () => {
    GeoTIFF.mockImplementationOnce(function (opts) {
      stubGeoTiffSource.call(this, opts)
      this.getView = vi.fn(() => new Promise(() => {}))
    })

    const creating = createCogOverviewLayer({ type: 'cog', url: '/broken.tif' }, 'gep-test-fgb-overview', { styleConfig })
    const source = GeoTIFF.mock.instances.at(-1)
    source._fail(new Error('not a COG'))

    await expect(creating).rejects.toThrow('not a COG')
    expect(WebGLTileLayer).not.toHaveBeenCalled()
  })

  test('does not request metadata from an already failed source', async () => {
    GeoTIFF.mockImplementationOnce(function (opts) {
      stubGeoTiffSource.call(this, opts)
      this._fail(new Error('not a COG'))
    })

    const creating = createCogOverviewLayer({ type: 'cog', url: '/broken.tif' }, 'gep-test-fgb-overview', { styleConfig })
    const source = GeoTIFF.mock.instances.at(-1)

    await expect(creating).rejects.toThrow('not a COG')
    expect(source.getView).not.toHaveBeenCalled()
    expect(WebGLTileLayer).not.toHaveBeenCalled()
  })
})
