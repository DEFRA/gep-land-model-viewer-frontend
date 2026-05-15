// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('@defra/interactive-map', () => ({
  EVENTS: {
    MAP_RENDER: 'map:render'
  }
}))

vi.mock('ol/Feature.js', () => ({
  default: vi.fn().mockImplementation(function (opts) {
    this.geometry = opts?.geometry
  })
}))

vi.mock('ol/geom/LineString.js', () => ({
  default: vi.fn().mockImplementation(function (coords) {
    this.type = 'LineString'
    this.coords = coords
  })
}))

vi.mock('ol/geom/Polygon.js', () => ({
  default: vi.fn().mockImplementation(function (rings) {
    this.type = 'Polygon'
    this.rings = rings
  })
}))

vi.mock('ol/source/Vector.js', () => ({
  default: vi.fn().mockImplementation(function () {
    this.features = []
    this.clear = vi.fn(() => { this.features = [] })
    this.addFeature = vi.fn((f) => { this.features.push(f) })
    this.addFeatures = vi.fn((fs) => { this.features.push(...fs) })
  })
}))

vi.mock('ol/layer/WebGLVector.js', () => ({
  default: vi.fn().mockImplementation(function (opts) {
    this._opts = opts
    this.source = opts?.source
    this.setVisible = vi.fn()
  })
}))

const { createGridLayer } = await import('./grid-layer.js')
const { default: WebGLVectorLayer } = await import('ol/layer/WebGLVector.js')

function createMapHarness () {
  const handlers = {}
  return {
    on: vi.fn((event, handler) => {
      handlers[event] = handler
    }),
    _handlers: handlers
  }
}

function createOlMapMock (zoom = 17, extent = [418700, 385100, 418900, 385300], resolution = 1) {
  const layers = []
  const view = {
    getZoom: vi.fn(() => zoom),
    getResolution: vi.fn(() => resolution),
    calculateExtent: vi.fn(() => extent)
  }
  return {
    addLayer: vi.fn((layer) => { layers.push(layer) }),
    getView: vi.fn(() => view),
    getSize: vi.fn(() => [800, 600]),
    _layers: layers,
    _view: view
  }
}

describe('#createGridLayer', () => {
  let interactiveMap
  let olMap

  beforeEach(() => {
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(cb => { cb(); return 1 })
    interactiveMap = createMapHarness()
    olMap = createOlMapMock()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  test('creates grid and selected WebGL layers', () => {
    createGridLayer(interactiveMap, olMap)

    expect(olMap.addLayer).toHaveBeenCalledTimes(2)
    expect(WebGLVectorLayer).toHaveBeenCalledTimes(2)
  })

  test('highlightCell adds feature to selected source', () => {
    const api = createGridLayer(interactiveMap, olMap)

    api.highlightCell(418720, 385130)

    const selectedLayer = olMap._layers[1]
    const selectedSource = selectedLayer.source
    expect(selectedSource.clear).toHaveBeenCalled()
    expect(selectedSource.addFeature).toHaveBeenCalled()
  })

  test('clearHighlight clears selected source', () => {
    const api = createGridLayer(interactiveMap, olMap)

    api.clearHighlight()

    const selectedLayer = olMap._layers[1]
    expect(selectedLayer.source.clear).toHaveBeenCalled()
  })

  test('setEnabled toggles selected layer visibility', () => {
    const api = createGridLayer(interactiveMap, olMap)

    api.setEnabled(true)
    const selectedLayer = olMap._layers[1]
    expect(selectedLayer.setVisible).toHaveBeenCalledWith(true)

    api.setEnabled(false)
    expect(selectedLayer.setVisible).toHaveBeenCalledWith(false)
  })

  test('does not draw grid when zoom too low', () => {
    olMap = createOlMapMock(8)
    const api = createGridLayer(interactiveMap, olMap)
    api.setEnabled(true)

    const gridSource = olMap._layers[0].source
    expect(gridSource.addFeatures).not.toHaveBeenCalled()
  })

  test('draws grid lines when enabled and zoom is appropriate', () => {
    olMap = createOlMapMock(17)
    const api = createGridLayer(interactiveMap, olMap)
    api.setEnabled(true)

    const gridSource = olMap._layers[0].source
    expect(gridSource.addFeatures).toHaveBeenCalled()
    expect(gridSource.features.length).toBeGreaterThan(0)
  })

  test('does not draw grid until enabled, even at high zoom', () => {
    olMap = createOlMapMock(17)
    createGridLayer(interactiveMap, olMap)

    const gridSource = olMap._layers[0].source
    expect(gridSource.addFeatures).not.toHaveBeenCalled()
  })

  test('setEnabled(false) clears the grid', () => {
    const api = createGridLayer(interactiveMap, olMap)
    const gridSource = olMap._layers[0].source
    api.setEnabled(true)
    gridSource.clear.mockClear()
    gridSource.addFeatures.mockClear()

    api.setEnabled(false)

    expect(gridSource.clear).toHaveBeenCalled()
    expect(gridSource.addFeatures).not.toHaveBeenCalled()
  })

  test('skips rebuild when viewport is still inside the drawn grid', () => {
    olMap = createOlMapMock(17)
    const api = createGridLayer(interactiveMap, olMap)
    api.setEnabled(true)

    const gridSource = olMap._layers[0].source
    expect(gridSource.addFeatures).toHaveBeenCalledTimes(1)
    gridSource.addFeatures.mockClear()
    gridSource.clear.mockClear()

    interactiveMap._handlers['map:render']()

    expect(gridSource.clear).not.toHaveBeenCalled()
    expect(gridSource.addFeatures).not.toHaveBeenCalled()
  })

  test('rebuilds grid when viewport moves outside drawn extent', () => {
    olMap = createOlMapMock(17)
    const api = createGridLayer(interactiveMap, olMap)
    api.setEnabled(true)

    const gridSource = olMap._layers[0].source
    gridSource.addFeatures.mockClear()
    gridSource.clear.mockClear()

    olMap._view.calculateExtent.mockReturnValue([500000, 500000, 500200, 500200])

    interactiveMap._handlers['map:render']()

    expect(gridSource.clear).toHaveBeenCalled()
    expect(gridSource.addFeatures).toHaveBeenCalled()
  })

  test('limits grid lines when extent is too large', () => {
    olMap = createOlMapMock(17, [0, 0, 100000, 100000])
    const api = createGridLayer(interactiveMap, olMap)
    api.setEnabled(true)

    const gridSource = olMap._layers[0].source
    expect(gridSource.addFeatures).not.toHaveBeenCalled()
  })
})
