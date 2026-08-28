import { vi, describe, test, expect, beforeEach } from 'vitest'
import { bbox } from 'ol/loadingstrategy.js'

function stubLayer (opts) {
  const properties = opts?.properties || {}
  const listeners = new Map()
  let visible = true
  this._opts = opts
  this.get = vi.fn((key) => properties[key])
  this.getVisible = vi.fn(() => visible)
  this.getMinZoom = vi.fn(() => opts?.minZoom ?? -Infinity)
  this.on = vi.fn((type, listener) => {
    const handlers = listeners.get(type) ?? []
    handlers.push(listener)
    listeners.set(type, handlers)
  })
  this.addEventListener = this.on
  this.emit = (type, event) => {
    for (const listener of listeners.get(type) ?? []) {
      listener(event)
    }
  }
  this.setVisible = vi.fn((next) => {
    visible = next
    for (const listener of listeners.get('change:visible') ?? []) {
      listener()
    }
  })
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

vi.mock('./fgb-loader.js', () => ({
  createFgbLoadController: vi.fn(() => ({
    loader: 'fgb-loader',
    retryFailedExtents: vi.fn(() => false)
  }))
}))

vi.mock('./pmtiles.js', () => ({
  createPmtilesLayer: vi.fn(async (url, layerId, options) => {
    const layer = {}
    stubLayer.call(layer, { properties: { id: layerId }, opacity: options.opacity })
    return layer
  })
}))

vi.mock('./cog.js', () => ({
  createCogOverviewLayer: vi.fn(async (overview, layerId) => {
    const layer = {}
    stubLayer.call(layer, { properties: { id: layerId } })
    return layer
  })
}))

vi.mock('../style-config.js', () => ({
  validateStyleConfig: vi.fn(),
  vectorStyleFor: vi.fn(() => ({ 'fill-color': ['match', ['get', 'category'], 'Bog', [194, 158, 215, 1], [0, 0, 0, 0]] }))
}))

const { default: WebGLVectorLayer } = await import('ol/layer/WebGLVector.js')
const { default: VectorSource } = await import('ol/source/Vector.js')
const { createFgbLoadController } = await import('./fgb-loader.js')
const { createPmtilesLayer } = await import('./pmtiles.js')
const { createCogOverviewLayer } = await import('./cog.js')
const { validateStyleConfig, vectorStyleFor } = await import('../style-config.js')
const { createFlatGeobufLayers } = await import('./fgb.js')

const STYLE_CONFIG = {
  field: 'category',
  classes: [{ bandValue: 1, fieldValue: 'Bog', label: 'Bog', fill: [194, 158, 215, 1] }]
}

function fgbDataset (source = {}) {
  return {
    id: 'test-fgb',
    label: 'Test FlatGeobuf',
    source: {
      type: 'fgb',
      url: '/land-model/vector/test.fgb',
      opacity: 0.7,
      styleConfig: STYLE_CONFIG,
      ...source
    }
  }
}

function mapHarness ({ zoom = 8 } = {}) {
  const handlers = new Map()
  const extent = [100, 200, 300, 400]
  const view = {
    getZoom: vi.fn(() => zoom),
    calculateExtent: vi.fn(() => extent)
  }
  const map = {
    getView: vi.fn(() => view),
    getSize: vi.fn(() => [800, 600]),
    on: vi.fn((type, listener) => {
      const listeners = handlers.get(type) ?? []
      listeners.push(listener)
      handlers.set(type, listeners)
    }),
    emit: (type) => {
      for (const listener of handlers.get(type) ?? []) {
        listener()
      }
    }
  }

  return { map, view, extent }
}

function latestLoadController () {
  return createFgbLoadController.mock.results.at(-1).value
}

describe('#createFlatGeobufLayers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('validates the style config, styles the layer and wires its load controller', async () => {
    const { map } = mapHarness()
    const layers = await createFlatGeobufLayers(fgbDataset(), 'gep-test-fgb', map)

    expect(layers).toHaveLength(1)
    expect(validateStyleConfig).toHaveBeenCalledWith(STYLE_CONFIG, 'test-fgb', { requireBandValues: false })
    expect(vectorStyleFor).toHaveBeenCalledWith(STYLE_CONFIG)

    const source = VectorSource.mock.instances[0]
    expect(source._opts.strategy).toBe(bbox)
    expect(source._opts.useSpatialIndex).toBe(false)
    expect(createFgbLoadController).toHaveBeenCalledWith(source, '/land-model/vector/test.fgb', layers[0])
    expect(source.setLoader).toHaveBeenCalledWith(latestLoadController().loader)

    const [layerOptions] = WebGLVectorLayer.mock.calls[0]
    expect(layerOptions.properties).toEqual({ id: 'gep-test-fgb' })
    expect(layerOptions.style).toEqual(vectorStyleFor.mock.results[0].value)
    expect(layerOptions.minZoom).toBeUndefined()
    expect(layerOptions.opacity).toBe(0.7)
    expect(layerOptions.className).toBeUndefined()
  })

  test('retries a failed visible viewport once the user finishes moving', async () => {
    const { map, extent } = mapHarness()
    await createFlatGeobufLayers(fgbDataset(), 'gep-test-fgb', map)

    map.emit('moveend')

    expect(latestLoadController().retryFailedExtents).toHaveBeenCalledWith(extent)
  })

  test('does not retry while detail is outside its zoom range', async () => {
    const { map } = mapHarness({ zoom: 5 })
    await createFlatGeobufLayers(fgbDataset({ minZoom: 7 }), 'gep-test-fgb', map)

    map.emit('moveend')

    expect(latestLoadController().retryFailedExtents).not.toHaveBeenCalled()
  })

  test('turning a dataset back on permits one attempt over the current viewport', async () => {
    const { map, extent } = mapHarness()
    const [detail] = await createFlatGeobufLayers(fgbDataset(), 'gep-test-fgb', map)
    const controller = latestLoadController()

    detail.setVisible(false)
    expect(controller.retryFailedExtents).not.toHaveBeenCalled()

    detail.setVisible(true)
    expect(controller.retryFailedExtents).toHaveBeenCalledWith(extent)
  })

  test('an invalid style config rejects before any layer is built', async () => {
    validateStyleConfig.mockImplementationOnce(() => {
      throw new Error('Dataset test-fgb style config must define classes')
    })

    await expect(createFlatGeobufLayers(fgbDataset(), 'gep-test-fgb', mapHarness().map)).rejects.toThrow(
      'Dataset test-fgb style config must define classes'
    )
    expect(WebGLVectorLayer).not.toHaveBeenCalled()
  })

  test('a configured minZoom caps the detail layer', async () => {
    await createFlatGeobufLayers(fgbDataset({ minZoom: 7 }), 'gep-test-fgb', mapHarness().map)

    const [layerOptions] = WebGLVectorLayer.mock.calls[0]
    expect(layerOptions.minZoom).toBe(6)
  })

  test('a pmtiles overview takes the zooms below its max', async () => {
    const dataset = fgbDataset({
      overview: { type: 'pmtiles', url: '/land-model/tiles/with-overview.pmtiles', maxZoom: 4 }
    })

    const layers = await createFlatGeobufLayers(dataset, 'gep-test-fgb', mapHarness().map)

    expect(layers.map(layer => layer.get('id'))).toEqual([
      'gep-test-fgb',
      'gep-test-fgb-overview'
    ])
    const [detailOptions] = WebGLVectorLayer.mock.calls[0]
    expect(detailOptions.minZoom).toBe(4)
    expect(createPmtilesLayer).toHaveBeenCalledWith(
      '/land-model/tiles/with-overview.pmtiles',
      'gep-test-fgb-overview',
      { style: detailOptions.style, maxZoom: 4, opacity: 0.7 }
    )
  })

  test.each([
    ['COG', { type: 'cog', url: '/land-model/raster/broken.tif' }, createCogOverviewLayer],
    ['PMTiles', { type: 'pmtiles', url: '/land-model/tiles/broken.pmtiles', maxZoom: 4 }, createPmtilesLayer]
  ])('a failed %s overview does not leave load recovery registered', async (_type, overview, createOverview) => {
    createOverview.mockRejectedValueOnce(new Error('overview failed'))
    const { map } = mapHarness()

    await expect(createFlatGeobufLayers(fgbDataset({ overview }), 'gep-test-fgb', map)).rejects.toThrow('overview failed')

    expect(createFgbLoadController).not.toHaveBeenCalled()
    expect(map.on).not.toHaveBeenCalled()
  })

  test('an unsupported overview type throws before any layer is built', async () => {
    const dataset = fgbDataset({
      overview: { type: 'wmts', url: '/land-model/tiles/bad-overview', maxZoom: 4 }
    })

    await expect(createFlatGeobufLayers(dataset, 'gep-test-fgb', mapHarness().map)).rejects.toThrow(
      'Dataset test-fgb has unsupported overview type "wmts", only pmtiles and cog are supported'
    )
    expect(WebGLVectorLayer).not.toHaveBeenCalled()
  })

  test('a cog overview remains under detail with opacity on their shared canvas', async () => {
    const dataset = fgbDataset({
      minZoom: 5,
      overview: { type: 'cog', url: '/land-model/raster/overview.tif' }
    })

    const layers = await createFlatGeobufLayers(dataset, 'gep-test-fgb', mapHarness().map)

    expect(layers.map(layer => layer.get('id'))).toEqual([
      'gep-test-fgb-overview',
      'gep-test-fgb'
    ])
    const [detailOptions] = WebGLVectorLayer.mock.calls[0]
    expect(detailOptions.minZoom).toBe(4)
    expect(detailOptions.opacity).toBe(1)
    expect(detailOptions.className).toBe('ol-layer gep-test-fgb-composite')
    expect(validateStyleConfig).toHaveBeenCalledWith(STYLE_CONFIG, 'test-fgb', { requireBandValues: true })
    expect(createCogOverviewLayer).toHaveBeenCalledWith(
      dataset.source.overview,
      'gep-test-fgb-overview',
      {
        styleConfig: STYLE_CONFIG,
        className: 'ol-layer gep-test-fgb-composite'
      }
    )
    let opacity = ''
    const setOpacity = vi.fn((value) => { opacity = value })
    const style = {}
    Object.defineProperty(style, 'opacity', {
      get: () => opacity,
      set: setOpacity
    })
    const canvas = { style }
    layers[0].emit('precompose', { context: { canvas } })
    expect(canvas.style.opacity).toBe('0.7')

    layers[1].emit('precompose', { context: { canvas } })
    expect(setOpacity).toHaveBeenCalledTimes(1)

    opacity = ''
    layers[1].emit('precompose', { context: { canvas } })
    expect(canvas.style.opacity).toBe('0.7')
    expect(setOpacity).toHaveBeenCalledTimes(2)
  })
})
