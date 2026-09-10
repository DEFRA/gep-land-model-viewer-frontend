import { vi, describe, test, expect, beforeEach } from 'vitest'
import { bbox } from 'ol/loadingstrategy.js'
import { getLayerStyle } from '../layer-style.js'
import cromeStyle from '../../../../../../data/styles/crop-map-of-england.json'

function stubLayer (opts) {
  const properties = opts?.properties || {}
  const listeners = new Map()
  let visible = true
  this._opts = opts
  this.get = vi.fn((key) => properties[key])
  this.changed = vi.fn()
  this.updateStyleVariables = vi.fn()
  this.setOpacity = vi.fn()
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
    return { layers: [layer], applyStyle: vi.fn(), setOpacity: vi.fn() }
  })
}))

vi.mock('./cog.js', () => ({
  createCogOverviewLayer: vi.fn(async (overview, layerId, { className, styleConfig }) => {
    const layer = {}
    stubLayer.call(layer, { properties: { id: layerId }, className, styleConfig, opacity: 1 })
    return { layers: [layer], applyStyle: vi.fn(), setOpacity: vi.fn() }
  })
}))

const { default: WebGLVectorLayer } = await import('ol/layer/WebGLVector.js')
const { default: VectorSource } = await import('ol/source/Vector.js')
const { createFgbLoadController } = await import('./fgb-loader.js')
const { createPmtilesLayer } = await import('./pmtiles.js')
const { createCogOverviewLayer } = await import('./cog.js')
const { createFlatGeobufLayer } = await import('./fgb.js')

const MATCH_STYLE_CONFIG = {
  type: 'match',
  field: 'category',
  classes: [{ bandValue: 1, fieldValues: ['Bog'], label: 'Bog', fill: [194, 158, 215, 1] }]
}

function fgbDataset (source = {}) {
  return {
    id: 'test-fgb',
    label: 'Test FlatGeobuf',
    source: {
      type: 'fgb',
      url: '/land-model/vector/test.fgb',
      opacity: 0.7,
      styleConfig: MATCH_STYLE_CONFIG,
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

describe('#createFlatGeobufLayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('styles the layer and wires its load controller', async () => {
    const { map } = mapHarness()
    const { layers } = await createFlatGeobufLayer(fgbDataset(), 'gep-test-fgb', map)

    expect(layers).toHaveLength(1)

    const source = VectorSource.mock.instances[0]
    expect(source._opts.strategy).toBe(bbox)
    expect(source._opts.useSpatialIndex).toBe(false)
    expect(createFgbLoadController).toHaveBeenCalledWith(source, '/land-model/vector/test.fgb', layers[0])
    expect(source.setLoader).toHaveBeenCalledWith(latestLoadController().loader)

    const [layerOptions] = WebGLVectorLayer.mock.calls[0]
    expect(layerOptions.properties).toEqual({ id: 'gep-test-fgb' })
    expect(layerOptions.style).toEqual({ 'fill-color': ['match', ['get', 'category'], 'Bog', ['var', 'class_0_fill'], [0, 0, 0, 0]] })
    expect(layerOptions.variables).toEqual({ class_0_fill: 'rgba(194, 158, 215, 1)' })
    expect(layerOptions.minZoom).toBeUndefined()
    expect(layerOptions.opacity).toBe(0.7)
    expect(layerOptions.className).toBeUndefined()
  })

  test('retries a failed visible viewport once the user finishes moving', async () => {
    const { map, extent } = mapHarness()
    await createFlatGeobufLayer(fgbDataset(), 'gep-test-fgb', map)

    map.emit('moveend')

    expect(latestLoadController().retryFailedExtents).toHaveBeenCalledWith(extent)
  })

  test('does not retry while detail is outside its zoom range', async () => {
    const { map } = mapHarness({ zoom: 5 })
    await createFlatGeobufLayer(fgbDataset({ minZoom: 7 }), 'gep-test-fgb', map)

    map.emit('moveend')

    expect(latestLoadController().retryFailedExtents).not.toHaveBeenCalled()
  })

  test('turning a dataset back on permits one attempt over the current viewport', async () => {
    const { map, extent } = mapHarness()
    const { layers: [detail] } = await createFlatGeobufLayer(fgbDataset(), 'gep-test-fgb', map)
    const controller = latestLoadController()

    detail.setVisible(false)
    expect(controller.retryFailedExtents).not.toHaveBeenCalled()

    detail.setVisible(true)
    expect(controller.retryFailedExtents).toHaveBeenCalledWith(extent)
  })

  test('a configured minZoom caps the detail layer', async () => {
    await createFlatGeobufLayer(fgbDataset({ minZoom: 7 }), 'gep-test-fgb', mapHarness().map)

    const [layerOptions] = WebGLVectorLayer.mock.calls[0]
    expect(layerOptions.minZoom).toBe(6)
  })

  test('a pmtiles overview takes the zooms below its max', async () => {
    const dataset = fgbDataset({
      overview: { type: 'pmtiles', url: '/land-model/tiles/with-overview.pmtiles', maxZoom: 4 }
    })

    const { layers } = await createFlatGeobufLayer(dataset, 'gep-test-fgb', mapHarness().map)

    expect(layers.map(layer => layer.get('id'))).toEqual([
      'gep-test-fgb',
      'gep-test-fgb-overview'
    ])
    const [detailOptions] = WebGLVectorLayer.mock.calls[0]
    expect(detailOptions.minZoom).toBe(4)
    expect(createPmtilesLayer).toHaveBeenCalledWith(
      '/land-model/tiles/with-overview.pmtiles',
      'gep-test-fgb-overview',
      {
        styleConfig: MATCH_STYLE_CONFIG,
        maxZoom: 4,
        opacity: 0.7
      }
    )
  })

  test.each([
    ['COG', { type: 'cog', url: '/land-model/raster/broken.tif' }, createCogOverviewLayer],
    ['PMTiles', { type: 'pmtiles', url: '/land-model/tiles/broken.pmtiles', maxZoom: 4 }, createPmtilesLayer]
  ])('a failed %s overview does not leave load recovery registered', async (_type, overview, createOverview) => {
    createOverview.mockRejectedValueOnce(new Error('overview failed'))
    const { map } = mapHarness()

    await expect(createFlatGeobufLayer(fgbDataset({ overview }), 'gep-test-fgb', map)).rejects.toThrow('overview failed')

    expect(createFgbLoadController).not.toHaveBeenCalled()
    expect(map.on).not.toHaveBeenCalled()
  })

  test('an unsupported overview type throws before any layer is built', async () => {
    const dataset = fgbDataset({
      overview: { type: 'wmts', url: '/land-model/tiles/bad-overview', maxZoom: 4 }
    })

    await expect(createFlatGeobufLayer(dataset, 'gep-test-fgb', mapHarness().map)).rejects.toThrow(
      'Dataset test-fgb has unsupported overview type "wmts", only pmtiles and cog are supported'
    )
    expect(WebGLVectorLayer).not.toHaveBeenCalled()
  })

  test('a cog overview remains under detail with opacity on their shared canvas', async () => {
    const dataset = fgbDataset({
      minZoom: 5,
      overview: { type: 'cog', url: '/land-model/raster/overview.tif' }
    })

    const datasetLayer = await createFlatGeobufLayer(dataset, 'gep-test-fgb', mapHarness().map)
    const { layers } = datasetLayer

    expect(layers.map(layer => layer.get('id'))).toEqual([
      'gep-test-fgb-overview',
      'gep-test-fgb'
    ])
    const [detailOptions] = WebGLVectorLayer.mock.calls[0]
    expect(detailOptions.minZoom).toBe(4)
    expect(detailOptions.opacity).toBe(1)
    expect(detailOptions.className).toBe('ol-layer gep-test-fgb-composite')
    expect(createCogOverviewLayer).toHaveBeenCalledWith(
      dataset.source.overview,
      'gep-test-fgb-overview',
      {
        styleConfig: MATCH_STYLE_CONFIG,
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

    datasetLayer.setOpacity(0.01)
    for (const layer of layers) {
      opacity = ''
      layer.emit('precompose', { context: { canvas } })
      expect(canvas.style.opacity).toBe('0.01')
      expect(layer.changed).toHaveBeenCalledOnce()
      expect(layer.setOpacity).not.toHaveBeenCalled()
    }
  })

  test.each([
    ['no overview', undefined],
    ['a PMTiles overview', 'pmtiles'],
    ['a COG overview', 'cog']
  ])('applies fill, outline and opacity changes with %s', async (_description, overviewType) => {
    const dataset = fgbDataset({
      styleConfig: {
        type: 'uniform',
        classes: [{ bandValue: 1, fill: [10, 20, 30, 0.6], stroke: { color: [40, 50, 60, 0.8], width: 1.25 } }]
      },
      overview: overviewType && { type: overviewType, url: '/overview', maxZoom: 4 }
    })
    const datasetLayer = await createFlatGeobufLayer(dataset, 'gep-test-fgb', mapHarness().map)
    const detail = WebGLVectorLayer.mock.instances[0]
    const { styleConfig: updatedStyle } = getLayerStyle(dataset, {
      styleOverrides: { classes: [{ fill: [255, 0, 0, 0.6], stroke: { color: [0, 0, 0, 0.8] } }] }
    })

    datasetLayer.applyStyle(updatedStyle)
    datasetLayer.setOpacity(0.4)

    expect(detail.updateStyleVariables).toHaveBeenLastCalledWith({ class_0_fill: 'rgba(255, 0, 0, 0.6)', class_0_stroke: 'rgba(0, 0, 0, 0.8)' })
    if (overviewType === 'cog') {
      const overviewLayer = await createCogOverviewLayer.mock.results[0].value
      expect(overviewLayer.applyStyle).toHaveBeenCalledWith(updatedStyle)
      expect(overviewLayer.setOpacity).not.toHaveBeenCalled()
      expect(detail.setOpacity).not.toHaveBeenCalled()
    } else {
      expect(detail.setOpacity).toHaveBeenCalledWith(0.4)
      if (overviewType === 'pmtiles') {
        const overviewLayer = await createPmtilesLayer.mock.results[0].value
        expect(overviewLayer.applyStyle).toHaveBeenCalledWith(updatedStyle)
        expect(overviewLayer.setOpacity).toHaveBeenCalledWith(0.4)
      }
    }
  })

  test('edits and resets CROME colours without recreating the renderer or source', async () => {
    const { default: ActualWebGLVectorLayer } = await vi.importActual('ol/layer/WebGLVector.js')
    const { default: ActualVectorSource } = await vi.importActual('ol/source/Vector.js')
    WebGLVectorLayer.mockImplementationOnce(function (options) { return new ActualWebGLVectorLayer(options) })
    VectorSource.mockImplementationOnce(function (options) { return new ActualVectorSource(options) })
    const dataset = fgbDataset({ styleConfig: cromeStyle })
    const datasetLayer = await createFlatGeobufLayer(dataset, 'gep-test-fgb', mapHarness().map)
    const [detail] = datasetLayer.layers
    const renderer = detail.getRenderer()
    const source = detail.getSource()

    try {
      datasetLayer.applyStyle(getLayerStyle(dataset, { styleOverrides: { classes: [{ fill: [255, 0, 0, 1] }] } }).styleConfig)
      expect(detail.getRenderer()).toBe(renderer)
      expect(detail.getSource()).toBe(source)

      datasetLayer.applyStyle(cromeStyle)
      expect(detail.getRenderer()).toBe(renderer)
      expect(detail.getSource()).toBe(source)
    } finally {
      detail.dispose()
    }
  })
})
