// @vitest-environment jsdom
import { vi, describe, test, expect, afterEach } from 'vitest'

vi.mock('@defra/interactive-map', () => {
  const handlers = {}
  const MockInteractiveMap = vi.fn().mockImplementation(function () {
    this.on = vi.fn((event, handler) => { handlers[event] = handler })
    this._handlers = handlers
  })
  MockInteractiveMap._handlers = handlers
  return {
    default: MockInteractiveMap,
    EVENTS: { MAP_READY: 'map:ready' }
  }
})

vi.mock('@defra/interactive-map/providers/openlayers', () => ({
  default: vi.fn(() => ({ provider: 'openlayers' }))
}))

vi.mock('@defra/interactive-map/plugins/map-styles', () => ({
  default: vi.fn(() => ({ id: 'mapStyles' }))
}))

vi.mock('@defra/interactive-map/plugins/search', () => ({
  default: vi.fn(() => ({ id: 'search' }))
}))

vi.mock('./config/map-styles.js', () => ({
  mapStyles: [{ id: 'outdoor', label: 'Outdoor', url: '/style.json' }]
}))

vi.mock('./plugins/feature/index.js', () => ({
  registerFeatureController: vi.fn(() => ({ minZoom: 10, setVisible: vi.fn() }))
}))

vi.mock('./plugins/info-panel/index.js', () => ({
  registerInfoPanel: vi.fn(() => ({ activate: vi.fn(), deactivate: vi.fn() }))
}))

vi.mock('./plugins/grid/index.js', () => ({
  registerGridController: vi.fn(() => ({ setVisible: vi.fn() }))
}))

vi.mock('./plugins/layers/index.js', () => ({
  registerLayersPanel: vi.fn()
}))

vi.mock('./plugins/layers/dataset-hits.js', () => ({
  createDatasetHitSource: vi.fn(() => ({ getHits: vi.fn(), clearSelection: vi.fn() }))
}))

vi.mock('./plugins/north-indicator/index.js', () => ({
  createNorthIndicatorPlugin: vi.fn(() => ({ id: 'gepNorthIndicator' }))
}))

describe('map entry point', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('creates the map with the OpenLayers provider and plugins', async () => {
    const InteractiveMap = (await import('@defra/interactive-map')).default
    const createOpenLayersProvider = (await import('@defra/interactive-map/providers/openlayers')).default
    const mapStylesPlugin = (await import('@defra/interactive-map/plugins/map-styles')).default
    const searchPlugin = (await import('@defra/interactive-map/plugins/search')).default

    await import('./index.js')

    expect(createOpenLayersProvider).toHaveBeenCalledWith({ zoomAlignment: 'uk' })
    expect(searchPlugin).toHaveBeenCalledWith(expect.objectContaining({
      osNamesURL: '/os/names/find?query={query}'
    }))
    expect(mapStylesPlugin).toHaveBeenCalled()
    expect(InteractiveMap).toHaveBeenCalledWith(
      'land-map',
      expect.objectContaining({
        mapProvider: { provider: 'openlayers' },
        mapStyle: { id: 'outdoor', label: 'Outdoor', url: '/style.json' },
        zoom: 7,
        minZoom: 0,
        maxZoom: 13
      })
    )
  })

  test('registers layers, grid and feature plugins when map is ready', async () => {
    const InteractiveMap = (await import('@defra/interactive-map')).default
    const { registerLayersPanel } = await import('./plugins/layers/index.js')
    const { registerGridController } = await import('./plugins/grid/index.js')
    const { registerFeatureController } = await import('./plugins/feature/index.js')
    const { registerInfoPanel } = await import('./plugins/info-panel/index.js')
    const { createDatasetHitSource } = await import('./plugins/layers/dataset-hits.js')

    await import('./index.js')

    const readyHandler = InteractiveMap._handlers['map:ready']
    expect(readyHandler).toBeDefined()

    const DoubleClickZoom = (await import('ol/interaction/DoubleClickZoom.js')).default
    const setConstrainResolution = vi.fn()
    const olMap = {
      getView: vi.fn(() => ({ setConstrainResolution })),
      addInteraction: vi.fn()
    }
    await readyHandler({ map: olMap, mapStyleId: 'outdoor' })

    expect(olMap.addInteraction).toHaveBeenCalledWith(expect.any(DoubleClickZoom))

    const infoPanel = registerInfoPanel.mock.results[0].value
    const grid = registerGridController.mock.results[0].value
    const features = registerFeatureController.mock.results[0].value
    expect(setConstrainResolution).toHaveBeenCalledWith(true)
    expect(registerInfoPanel).toHaveBeenCalledWith(expect.any(Object), olMap)
    expect(createDatasetHitSource).toHaveBeenCalledWith(olMap)
    expect(infoPanel.activate).toHaveBeenCalledWith(createDatasetHitSource.mock.results[0].value)
    expect(registerGridController).toHaveBeenCalledWith(expect.any(Object), olMap, infoPanel)
    expect(registerFeatureController).toHaveBeenCalledWith(expect.any(Object), olMap, 'outdoor', infoPanel)
    expect(registerLayersPanel).toHaveBeenCalledWith(expect.any(Object), olMap, 'outdoor', infoPanel, { grid, features })
  })
})
