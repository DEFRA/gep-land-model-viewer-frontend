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
  getFeatureDetails: vi.fn(() => Promise.resolve(null))
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
    const handlers = {}
    interactiveMap = {
      on: vi.fn((event, handler) => { handlers[event] = handler }),
      _handlers: handlers
    }
    olMap = {
      getPixelFromCoordinate: vi.fn(() => [100, 200]),
      getView: vi.fn(() => ({ getZoom: vi.fn(() => 12) }))
    }
    infoPanel = { activate: vi.fn(), deactivate: vi.fn() }
    mockFeatureLayer = createMockFeatureLayer()
    createFeatureLayer.mockReturnValue(mockFeatureLayer)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  function registeredSource () {
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

  test('setVisible(false) hides the layer and deactivates its source', () => {
    const controller = registerFeatureController(interactiveMap, olMap, 'os-outdoor-ngd', infoPanel)

    controller.setVisible(true)
    const source = infoPanel.activate.mock.calls[0][0]
    controller.setVisible(false)

    expect(mockFeatureLayer.setEnabled).toHaveBeenLastCalledWith(false)
    expect(infoPanel.deactivate).toHaveBeenCalledWith(source)
  })

  test('a click on a feature yields an OS feature hit', () => {
    mockFeatureLayer.findFeatureAtPixel.mockReturnValue({ osid: 'abc-123', description: 'Arable Land' })
    const source = registeredSource()

    const hits = source.getHits([418700, 385100])

    expect(olMap.getPixelFromCoordinate).toHaveBeenCalledWith([418700, 385100])
    expect(hits).toHaveLength(1)
    expect(hits[0].label).toBe('OS feature')
    expect(hits[0].panelTitle).toBe('OS feature')
    expect(mockFeatureLayer.selectFeature).not.toHaveBeenCalled()
  })

  test('selecting the hit highlights the feature by osid', () => {
    mockFeatureLayer.findFeatureAtPixel.mockReturnValue({ osid: 'abc-123' })
    const source = registeredSource()

    source.getHits([418700, 385100])[0].select()

    expect(mockFeatureLayer.selectFeature).toHaveBeenCalledWith('abc-123')
  })

  test('a click with nothing under it yields no hits', () => {
    mockFeatureLayer.findFeatureAtPixel.mockReturnValue(null)
    const source = registeredSource()

    expect(source.getHits([418700, 385100])).toEqual([])
    expect(mockFeatureLayer.selectFeature).not.toHaveBeenCalled()
  })

  test('loadDetails fetches details by osid', async () => {
    mockFeatureLayer.findFeatureAtPixel.mockReturnValue({ osid: 'abc-123' })
    const source = registeredSource()

    await source.getHits([418700, 385100])[0].loadDetails({ signal: null })

    expect(getFeatureDetails).toHaveBeenCalledWith('abc-123')
  })

  test('renderHtml renders the loaded parcel attributes', () => {
    mockFeatureLayer.findFeatureAtPixel.mockReturnValue({ osid: 'abc-123' })
    const source = registeredSource()

    const html = source.getHits([418700, 385100])[0].renderHtml({
      osid: 'abc-123',
      toid: 'osgb-1',
      landUse: { label: 'Agriculture', code: 'U011' },
      landCover: { dominantLabel: 'Improved grass', dominantCode: 'C021', isMixed: false, breakdown: [], source: 'src', date: null },
      soil: { dominantLabel: 'Brown soils', dominantCode: 'S050', isMixed: false, breakdown: [], source: 'src', date: null },
      topography: { source: 'LIDAR', date: new Date(2023, 2, 8) },
      elevation: { min: 1, mean: 2, mode: null, max: 3 },
      slope: { min: 0, mean: null, mode: 1, max: 2 },
      aspect: { mean: 0, label: 'FLAT' }
    })

    expect(html).toContain('abc-123')
    expect(html).toContain('Land cover')
  })

  test('renderHtml shows an unavailable message when there are no details', () => {
    mockFeatureLayer.findFeatureAtPixel.mockReturnValue({ osid: 'abc-123' })
    const source = registeredSource()

    const html = source.getHits([418700, 385100])[0].renderHtml(null)

    expect(html).toContain('abc-123')
    expect(html).toContain('unavailable')
  })

  test('clearSelection clears the feature selection', () => {
    const source = registeredSource()

    source.clearSelection()

    expect(mockFeatureLayer.clearSelection).toHaveBeenCalled()
  })
})
