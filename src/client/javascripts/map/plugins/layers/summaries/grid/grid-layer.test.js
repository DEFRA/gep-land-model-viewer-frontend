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
    this.setZIndex = vi.fn()
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

// First rung of TILE_GRID_RESOLUTIONS in @defra/interactive-map OpenLayers provider.
const UK_ZOOM_0_RESOLUTION = 896

function resolutionAtZoom (zoom) {
  return UK_ZOOM_0_RESOLUTION / 2 ** zoom
}

function linePositions (source, axis) {
  return source.features
    .map(feature => feature.geometry.coords)
    .filter(([start, end]) => start[axis] === end[axis])
    .map(([start]) => start[axis])
}

function createOlMapMock (zoom = 12, extent = [418700, 385100, 418900, 385300]) {
  const layers = []
  const view = {
    getZoom: vi.fn(() => zoom),
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

  test.each([10, 100, 1000, 10000, 100000])('highlights a %im cell using its captured size', size => {
    const api = createGridLayer(interactiveMap, olMap)

    api.highlightCell(460000, 470000, size)

    const selectedLayer = olMap._layers[1]
    const selectedSource = selectedLayer.source
    expect(selectedSource.clear).toHaveBeenCalled()
    expect(selectedSource.features[0].geometry.rings).toEqual([[
      [460000, 470000],
      [460000 + size, 470000],
      [460000 + size, 470000 + size],
      [460000, 470000 + size],
      [460000, 470000]
    ]])
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

  test('sets the grid z-index without moving the selection layer', () => {
    const api = createGridLayer(interactiveMap, olMap)

    api.setZIndex(3)

    expect(olMap._layers[0].setZIndex).toHaveBeenCalledWith(3)
    expect(olMap._layers[1].setZIndex).not.toHaveBeenCalled()
  })

  test.each([
    [12, 10],
    [9, 100],
    [6, 1000],
    [3, 10000],
    [0, 100000]
  ])('at UK zoom %i draws grid lines %im apart on the grid', (zoom, size) => {
    const resolution = resolutionAtZoom(zoom)
    olMap = createOlMapMock(zoom, [460000, 470000, 460000 + 800 * resolution, 470000 + 600 * resolution])
    createGridLayer(interactiveMap, olMap).setEnabled(true)

    for (const axis of [0, 1]) {
      const positions = linePositions(olMap._layers[0].source, axis)
      expect(positions.length).toBeGreaterThan(1)
      expect(positions.every(position => position % size === 0)).toBe(true)
      expect(positions.slice(1).every((position, index) => position - positions[index] === size)).toBe(true)
    }
  })

  test('does not draw grid until enabled, even at high zoom', () => {
    olMap = createOlMapMock(12)
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
    api.setEnabled(false)

    expect(gridSource.clear).toHaveBeenCalledTimes(1)
    expect(gridSource.addFeatures).not.toHaveBeenCalled()
  })

  test('skips rebuild when viewport is still inside the drawn grid', () => {
    olMap = createOlMapMock(12)
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
    olMap = createOlMapMock(12)
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

  test('rebuilds on a resolution threshold even if the viewport remains inside the buffer', () => {
    olMap = createOlMapMock(11)
    const api = createGridLayer(interactiveMap, olMap)
    api.setEnabled(true)
    const gridSource = olMap._layers[0].source
    gridSource.clear.mockClear()
    gridSource.addFeatures.mockClear()

    olMap._view.getZoom.mockReturnValue(10)
    interactiveMap._handlers['map:render']()

    expect(gridSource.clear).toHaveBeenCalledTimes(1)
    expect(gridSource.addFeatures).toHaveBeenCalledTimes(1)
    const eastings = linePositions(gridSource, 0)
    expect(eastings[1] - eastings[0]).toBe(100)
  })

  test('reuses the buffer when zoom changes within the same grid size', () => {
    const api = createGridLayer(interactiveMap, olMap)
    api.setEnabled(true)
    const gridSource = olMap._layers[0].source
    gridSource.clear.mockClear()
    gridSource.addFeatures.mockClear()

    olMap._view.getZoom.mockReturnValue(11)
    interactiveMap._handlers['map:render']()

    expect(gridSource.clear).not.toHaveBeenCalled()
    expect(gridSource.addFeatures).not.toHaveBeenCalled()
  })

  test('keeps the selected geometry when the displayed grid changes resolution', () => {
    const api = createGridLayer(interactiveMap, olMap)
    api.setEnabled(true)
    api.highlightCell(466720, 475130, 10)
    const selectedSource = olMap._layers[1].source
    const selectedFeature = selectedSource.features[0]
    selectedSource.clear.mockClear()
    selectedSource.addFeature.mockClear()

    olMap._view.getZoom.mockReturnValue(0)
    interactiveMap._handlers['map:render']()

    expect(selectedSource.clear).not.toHaveBeenCalled()
    expect(selectedSource.addFeature).not.toHaveBeenCalled()
    expect(selectedSource.features).toEqual([selectedFeature])
  })

  test.each(Array.from({ length: 14 }, (_, zoom) => zoom))('keeps grid drawing bounded on a 4K viewport at UK zoom %i', zoom => {
    const resolution = resolutionAtZoom(zoom)
    olMap = createOlMapMock(zoom, [0, 0, 3840 * resolution, 2160 * resolution])
    const api = createGridLayer(interactiveMap, olMap)
    api.setEnabled(true)

    const gridSource = olMap._layers[0].source
    expect(gridSource.features.length).toBeGreaterThan(0)
    expect(gridSource.features.length).toBeLessThan(1000)
  })
})
