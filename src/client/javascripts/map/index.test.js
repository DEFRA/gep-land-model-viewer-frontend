// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach } from 'vitest'

vi.mock('@arcgis/core/config.js', () => ({
  default: { assetsPath: '' }
}))

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

vi.mock('@defra/interactive-map/providers/esri', () => ({
  default: vi.fn(() => ({ provider: 'esri' }))
}))

vi.mock('@defra/interactive-map/plugins/map-styles', () => ({
  default: vi.fn(() => ({ id: 'mapStyles' }))
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

  test('loads the map and registers runtime extensions when ready', async () => {
    const interactiveMapModule = await import('@defra/interactive-map')
    const InteractiveMap = interactiveMapModule.default
    const mapStylesPlugin = (await import('@defra/interactive-map/plugins/map-styles')).default
    const { registerGridController } = await import('./plugins/grid/index.js')
    const { registerLayersPanel } = await import('./plugins/layers/index.js')
    const { registerViewMode } = await import('./plugins/view-mode/index.js')
    const esriConfig = (await import('@arcgis/core/config.js')).default

    await import('./index.js')

    expect(esriConfig.assetsPath).toBe('/public/arcgis-assets')
    expect(mapStylesPlugin).toHaveBeenCalled()
    expect(InteractiveMap).toHaveBeenCalled()

    const readyHandler = InteractiveMap._handlers['map:ready']
    expect(readyHandler).toBeDefined()

    const arcgisMap = {}
    const view = {}
    await readyHandler({ map: arcgisMap, view })

    expect(registerGridController).toHaveBeenCalledWith(expect.any(Object), arcgisMap, view)
    expect(registerViewMode).toHaveBeenCalledWith(expect.any(Object), view, expect.any(Object))
    expect(registerLayersPanel).toHaveBeenCalledWith(expect.any(Object), arcgisMap, view)
  })
})
