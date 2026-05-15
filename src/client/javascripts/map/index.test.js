// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach } from 'vitest'

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

vi.mock('./plugins/grid/index.js', () => ({
  registerGridController: vi.fn(() => ({ setVisible: vi.fn() }))
}))

vi.mock('./plugins/layers/index.js', () => ({
  registerLayersPanel: vi.fn()
}))

vi.mock('./plugins/view-mode/index.js', () => ({
  registerViewMode: vi.fn(),
  createViewModePlugin: vi.fn(() => ({ id: 'gepViewMode' }))
}))

describe('map entry point', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('creates the map with the OpenLayers provider and plugins', async () => {
    const InteractiveMap = (await import('@defra/interactive-map')).default
    const createOpenLayersProvider = (await import('@defra/interactive-map/providers/openlayers')).default
    const mapStylesPlugin = (await import('@defra/interactive-map/plugins/map-styles')).default
    const searchPlugin = (await import('@defra/interactive-map/plugins/search')).default

    await import('./index.js')

    expect(createOpenLayersProvider).toHaveBeenCalledWith({ zoomAlignment: 'world' })
    expect(searchPlugin).toHaveBeenCalled()
    expect(mapStylesPlugin).toHaveBeenCalled()
    expect(InteractiveMap).toHaveBeenCalledWith(
      'land-map',
      expect.objectContaining({
        mapProvider: { provider: 'openlayers' },
        mapStyle: { id: 'outdoor', label: 'Outdoor', url: '/style.json' },
        zoom: 14,
        minZoom: 5,
        maxZoom: 20
      })
    )
  })

  test('registers layers, grid and view-mode plugins when map is ready', async () => {
    const InteractiveMap = (await import('@defra/interactive-map')).default
    const { registerLayersPanel } = await import('./plugins/layers/index.js')
    const { registerGridController } = await import('./plugins/grid/index.js')
    const { registerViewMode } = await import('./plugins/view-mode/index.js')

    await import('./index.js')

    const readyHandler = InteractiveMap._handlers['map:ready']
    expect(readyHandler).toBeDefined()

    const olMap = {}
    readyHandler({ map: olMap })

    expect(registerLayersPanel).toHaveBeenCalledWith(expect.any(Object), olMap)
    expect(registerGridController).toHaveBeenCalledWith(expect.any(Object), olMap)
    expect(registerViewMode).toHaveBeenCalledWith(expect.any(Object), olMap, expect.any(Object))
  })
})
