// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('@defra/interactive-map', () => ({
  EVENTS: {
    MAP_STYLE_CHANGE: 'map:stylechange'
  }
}))

vi.mock('./feature-layer.js', () => ({
  createFeatureLayer: vi.fn()
}))

vi.mock('./data.js', () => ({
  getFeatureDetails: vi.fn(() => Promise.resolve({ description: null }))
}))

vi.mock('../../config/map-styles.js', () => ({
  OS_NGD_TILESET_URL: '/os/ngd/collections/ngd-base/tiles/27700',
  OS_NGD_STYLE_IDS: ['os-outdoor-ngd', 'os-road-ngd']
}))

const { createFeatureLayer } = await import('./feature-layer.js')
const { registerFeatureController } = await import('./index.js')
const { getFeatureDetails } = await import('./data.js')
const { FEATURE_VISIBLE_MIN_ZOOM } = await import('./constants.js')

function createMockFeatureLayer () {
  return {
    refreshSource: vi.fn(),
    selectFeature: vi.fn(),
    clearSelection: vi.fn(),
    setEnabled: vi.fn(),
    findFeatureAtPixel: vi.fn()
  }
}

describe('#registerFeatureController', () => {
  let interactiveMap
  let mockFeatureLayer
  let olMap
  let infoPanel

  beforeEach(() => {
    document.body.innerHTML = '<div class="app-map"><div id="map-container"></div></div>'
    const handlers = {}
    interactiveMap = {
      on: vi.fn((event, handler) => { handlers[event] = handler }),
      _handlers: handlers
    }
    olMap = {
      getTargetElement: vi.fn(() => document.getElementById('map-container')),
      getPixelFromCoordinate: vi.fn(() => [100, 200])
    }
    infoPanel = { activate: vi.fn(), deactivate: vi.fn() }
    mockFeatureLayer = createMockFeatureLayer()
    createFeatureLayer.mockReturnValue(mockFeatureLayer)
  })

  afterEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  function registeredInspector () {
    const api = registerFeatureController(interactiveMap, olMap, 'os-outdoor-ngd', infoPanel)
    api.setVisible(true)
    return infoPanel.activate.mock.calls[0][0]
  }

  test('shares the basemap source when the initial style serves the tileset', () => {
    registerFeatureController(interactiveMap, olMap, 'os-outdoor-ngd', infoPanel)

    expect(mockFeatureLayer.refreshSource).toHaveBeenCalledWith(true)
  })

  test('uses a dedicated source when the initial style does not serve the tileset', () => {
    registerFeatureController(interactiveMap, olMap, 'os-outdoor-raster', infoPanel)

    expect(mockFeatureLayer.refreshSource).toHaveBeenCalledWith(false)
  })

  test('style switch to another tileset style keeps sharing the basemap source', () => {
    registerFeatureController(interactiveMap, olMap, 'os-outdoor-ngd', infoPanel)
    mockFeatureLayer.refreshSource.mockClear()

    interactiveMap._handlers['map:stylechange']({ mapStyleId: 'os-road-ngd' })

    expect(mockFeatureLayer.refreshSource).toHaveBeenCalledWith(true)
  })

  test('style switch to a non-tileset style falls back to a dedicated source', () => {
    registerFeatureController(interactiveMap, olMap, 'os-outdoor-ngd', infoPanel)
    mockFeatureLayer.refreshSource.mockClear()

    interactiveMap._handlers['map:stylechange']({ mapStyleId: 'os-outdoor-raster' })

    expect(mockFeatureLayer.refreshSource).toHaveBeenCalledWith(false)
  })

  test('exposes minZoom matching the constant', () => {
    const controller = registerFeatureController(interactiveMap, olMap, 'os-outdoor-ngd', infoPanel)

    expect(controller.minZoom).toBe(FEATURE_VISIBLE_MIN_ZOOM)
  })

  test('setVisible(true) enables the feature layer and activates its inspector', () => {
    const controller = registerFeatureController(interactiveMap, olMap, 'os-outdoor-ngd', infoPanel)

    controller.setVisible(true)

    expect(mockFeatureLayer.setEnabled).toHaveBeenCalledWith(true)
    expect(infoPanel.activate).toHaveBeenCalled()
  })

  test('setVisible(false) hides the layer, clears the selection and deactivates', () => {
    const controller = registerFeatureController(interactiveMap, olMap, 'os-outdoor-ngd', infoPanel)

    controller.setVisible(true)
    const inspector = infoPanel.activate.mock.calls[0][0]
    controller.setVisible(false)

    expect(mockFeatureLayer.setEnabled).toHaveBeenLastCalledWith(false)
    expect(mockFeatureLayer.clearSelection).toHaveBeenCalled()
    expect(infoPanel.deactivate).toHaveBeenCalledWith(inspector)
  })

  test('setVisible toggles the feature cursor class on the map container', () => {
    const controller = registerFeatureController(interactiveMap, olMap, 'os-outdoor-ngd', infoPanel)
    const container = document.getElementById('map-container')

    controller.setVisible(true)
    expect(container.classList.contains('app-map--feature')).toBe(true)

    controller.setVisible(false)
    expect(container.classList.contains('app-map--feature')).toBe(false)
  })

  test('hitTest selects and returns the feature under the click', () => {
    mockFeatureLayer.findFeatureAtPixel.mockReturnValue({ osid: 'abc-123', description: 'Arable Land' })
    const inspector = registeredInspector()

    const hit = inspector.hitTest([418700, 385100])

    expect(olMap.getPixelFromCoordinate).toHaveBeenCalledWith([418700, 385100])
    expect(mockFeatureLayer.selectFeature).toHaveBeenCalledWith('abc-123')
    expect(hit).toEqual({ osid: 'abc-123', description: 'Arable Land' })
  })

  test('hitTest returns null without selecting when nothing is under the click', () => {
    mockFeatureLayer.findFeatureAtPixel.mockReturnValue(null)
    const inspector = registeredInspector()

    const hit = inspector.hitTest([418700, 385100])

    expect(hit).toBeNull()
    expect(mockFeatureLayer.selectFeature).not.toHaveBeenCalled()
  })

  test('loadDetails fetches details by osid', async () => {
    const inspector = registeredInspector()

    await inspector.loadDetails({ osid: 'abc-123' })

    expect(getFeatureDetails).toHaveBeenCalledWith('abc-123')
  })

  test('renderHtml prefers the loaded description over the tile description', () => {
    const inspector = registeredInspector()

    const html = inspector.renderHtml(
      { osid: 'abc-123', description: 'Tile Description' },
      { description: 'Model Description' }
    )

    expect(html).toContain('abc-123')
    expect(html).toContain('Model Description')
    expect(html).not.toContain('Tile Description')
  })

  test('renderHtml falls back to the tile description', () => {
    const inspector = registeredInspector()

    const html = inspector.renderHtml(
      { osid: 'abc-123', description: 'Tile Description' },
      { description: null }
    )

    expect(html).toContain('Tile Description')
  })

  test('clearSelection clears the feature selection', () => {
    const inspector = registeredInspector()

    inspector.clearSelection()

    expect(mockFeatureLayer.clearSelection).toHaveBeenCalled()
  })
})
