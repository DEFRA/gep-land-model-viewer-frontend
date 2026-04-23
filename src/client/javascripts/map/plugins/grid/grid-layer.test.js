// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('@defra/interactive-map', () => ({
  EVENTS: {
    MAP_RENDER: 'map:render'
  }
}))

vi.mock('@arcgis/core/layers/GraphicsLayer.js', () => ({
  default: vi.fn().mockImplementation(function (opts) {
    this.id = opts?.id
    this.listMode = opts?.listMode
    this.visible = true
    this.graphics = []
    this.removeAll = vi.fn(() => { this.graphics = [] })
    this.add = vi.fn((g) => { this.graphics.push(g) })
    this.addMany = vi.fn((gs) => { this.graphics.push(...gs) })
  })
}))

vi.mock('@arcgis/core/Graphic.js', () => ({
  default: vi.fn().mockImplementation(function (opts) {
    this.geometry = opts?.geometry
    this.symbol = opts?.symbol
  })
}))

const { createGridLayer } = await import('./grid-layer.js')
const { default: GraphicsLayer } = await import('@arcgis/core/layers/GraphicsLayer.js')

function createMapHarness () {
  const handlers = {}
  return {
    on: vi.fn((event, handler) => {
      handlers[event] = handler
    }),
    _handlers: handlers
  }
}

function createArcgisMapMock () {
  const layers = []
  return {
    add: vi.fn((layer) => { layers.push(layer) }),
    _layers: layers
  }
}

function createViewMock (zoom = 17, extent = { xmin: 418700, ymin: 385100, xmax: 418900, ymax: 385300, width: 200, height: 200 }) {
  return {
    zoom,
    resolution: 1,
    extent
  }
}

describe('#createGridLayer', () => {
  let interactiveMap
  let arcgisMap
  let view

  beforeEach(() => {
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(cb => { cb(); return 1 })
    interactiveMap = createMapHarness()
    arcgisMap = createArcgisMapMock()
    view = createViewMock()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  test('creates grid and selected graphics layers', async () => {
    await createGridLayer(interactiveMap, arcgisMap, view)

    expect(arcgisMap.add).toHaveBeenCalledTimes(2)
    expect(GraphicsLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'gep-grid' }))
    expect(GraphicsLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'gep-grid-selected' }))
  })

  test('layers are hidden from layer list', async () => {
    await createGridLayer(interactiveMap, arcgisMap, view)

    expect(GraphicsLayer).toHaveBeenCalledWith(expect.objectContaining({ listMode: 'hide' }))
  })

  test('registers MAP_RENDER event handler', async () => {
    await createGridLayer(interactiveMap, arcgisMap, view)

    expect(interactiveMap.on).toHaveBeenCalledWith('map:render', expect.any(Function))
  })

  test('highlightCell adds graphic to selected layer', async () => {
    const api = await createGridLayer(interactiveMap, arcgisMap, view)

    api.highlightCell(418720, 385130)

    const selectedLayer = arcgisMap._layers[1]
    expect(selectedLayer.removeAll).toHaveBeenCalled()
    expect(selectedLayer.add).toHaveBeenCalled()
  })

  test('clearHighlight removes graphics from selected layer', async () => {
    const api = await createGridLayer(interactiveMap, arcgisMap, view)

    api.clearHighlight()

    const selectedLayer = arcgisMap._layers[1]
    expect(selectedLayer.removeAll).toHaveBeenCalled()
  })

  test('setEnabled toggles selected layer visibility', async () => {
    const api = await createGridLayer(interactiveMap, arcgisMap, view)

    api.setEnabled(false)

    const selectedLayer = arcgisMap._layers[1]
    expect(selectedLayer.visible).toBe(false)
  })

  test('isVisible returns true when enabled and zoom is high enough', async () => {
    view.zoom = 17
    const api = await createGridLayer(interactiveMap, arcgisMap, view)

    expect(api.isVisible()).toBe(true)
  })

  test('isVisible returns false when zoom too low', async () => {
    view.zoom = 14
    const api = await createGridLayer(interactiveMap, arcgisMap, view)

    expect(api.isVisible()).toBe(false)
  })

  test('canShow returns true when zoom at threshold', async () => {
    view.zoom = 16
    const api = await createGridLayer(interactiveMap, arcgisMap, view)

    expect(api.canShow()).toBe(true)
  })

  test('canShow returns false when zoom below threshold', async () => {
    view.zoom = 15
    const api = await createGridLayer(interactiveMap, arcgisMap, view)

    expect(api.canShow()).toBe(false)
  })

  test('does not draw grid when zoom too low', async () => {
    view.zoom = 14
    await createGridLayer(interactiveMap, arcgisMap, view)

    const gridLayer = arcgisMap._layers[0]
    expect(gridLayer.addMany).not.toHaveBeenCalled()
  })

  test('draws grid lines when zoom is appropriate', async () => {
    view.zoom = 17
    await createGridLayer(interactiveMap, arcgisMap, view)

    const gridLayer = arcgisMap._layers[0]
    expect(gridLayer.addMany).toHaveBeenCalled()
    expect(gridLayer.graphics.length).toBeGreaterThan(0)
  })

  test('does not draw grid when disabled', async () => {
    const api = await createGridLayer(interactiveMap, arcgisMap, view)
    const gridLayer = arcgisMap._layers[0]

    gridLayer.removeAll.mockClear()
    gridLayer.addMany.mockClear()

    api.setEnabled(false)

    expect(gridLayer.removeAll).toHaveBeenCalled()
    expect(gridLayer.addMany).not.toHaveBeenCalled()
  })

  test('limits grid lines when extent is too large', async () => {
    view.extent = {
      xmin: 0,
      ymin: 0,
      xmax: 100000,
      ymax: 100000,
      width: 100000,
      height: 100000
    }
    view.zoom = 17
    await createGridLayer(interactiveMap, arcgisMap, view)

    const gridLayer = arcgisMap._layers[0]
    expect(gridLayer.addMany).not.toHaveBeenCalled()
  })
})
