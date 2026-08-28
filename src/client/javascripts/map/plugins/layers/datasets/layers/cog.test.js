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
  })
}))

vi.mock('../style-config.js', () => ({
  validateStyleConfig: vi.fn(),
  cogColorFor: vi.fn(() => ['case', ['==', ['band', 1], 1], [194, 158, 215, 1], [0, 0, 0, 0]])
}))

const { default: GeoTIFF } = await import('ol/source/GeoTIFF.js')
const { default: WebGLTileLayer } = await import('ol/layer/WebGLTile.js')
const { validateStyleConfig, cogColorFor } = await import('../style-config.js')
const { createCogLayer, createCogOverviewLayer } = await import('./cog.js')

const STYLE_CONFIG = {
  classes: [{ maxBandValue: 20, label: 'Up to 20cm', fill: [204, 204, 255, 1] }]
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('#createCogLayer', () => {
  test('creates a WebGL tile layer styled from the validated config', async () => {
    const dataset = {
      id: 'test-cog',
      source: {
        type: 'cog',
        url: '/land-model/raster/test.tif',
        opacity: 0.8,
        normalize: false,
        interpolate: false,
        styleConfig: STYLE_CONFIG
      }
    }

    await createCogLayer(dataset, 'gep-test-cog')

    expect(validateStyleConfig).toHaveBeenCalledWith(STYLE_CONFIG, 'test-cog')
    expect(GeoTIFF).toHaveBeenCalledWith({
      sources: [{ url: '/land-model/raster/test.tif' }],
      normalize: false,
      interpolate: false
    })

    expect(cogColorFor).toHaveBeenCalledWith(STYLE_CONFIG)
    const [layerOptions] = WebGLTileLayer.mock.calls[0]
    expect(layerOptions.properties).toEqual({ id: 'gep-test-cog' })
    expect(layerOptions.opacity).toBe(0.8)
    expect(layerOptions.style.color).toEqual(cogColorFor.mock.results[0].value)
  })

  test('rejects an invalid style config before any layer is built', async () => {
    validateStyleConfig.mockImplementationOnce(() => {
      throw new Error('Dataset test-cog style config must define classes')
    })
    const dataset = { id: 'test-cog', source: { type: 'cog', url: '/land-model/raster/test.tif' } }

    await expect(createCogLayer(dataset, 'gep-test-cog')).rejects.toThrow(
      'Dataset test-cog style config must define classes'
    )
    expect(WebGLTileLayer).not.toHaveBeenCalled()
  })
})

describe('#createCogOverviewLayer', () => {
  const styleConfig = {
    field: 'category',
    classes: [{ bandValue: 1, fieldValue: 'Bog', label: 'Bog', fill: [194, 158, 215, 1] }]
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

    expect(cogColorFor).toHaveBeenCalledWith(styleConfig)
    const [layerOptions] = WebGLTileLayer.mock.calls.at(-1)
    expect(layerOptions.properties).toEqual({ id: 'gep-test-fgb-overview' })
    expect(layerOptions.opacity).toBe(1)
    expect(layerOptions.className).toBe('ol-layer gep-test-fgb-composite')
    expect(layerOptions.style.color).toEqual(cogColorFor.mock.results.at(-1).value)
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
