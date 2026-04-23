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
  registerGridPlugin: vi.fn()
}))

vi.mock('./plugins/layers/index.js', () => ({
  registerLayersPanel: vi.fn()
}))

describe('map entry point', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('creates InteractiveMap with mapStylesPlugin and registers plugins on MAP_READY', async () => {
    const interactiveMapModule = await import('@defra/interactive-map')
    const InteractiveMap = interactiveMapModule.default
    const mapStylesPlugin = (await import('@defra/interactive-map/plugins/map-styles')).default
    const { registerGridPlugin } = await import('./plugins/grid/index.js')
    const { registerLayersPanel } = await import('./plugins/layers/index.js')
    const esriConfig = (await import('@arcgis/core/config.js')).default

    await import('./index.js')

    expect(esriConfig.assetsPath).toBe('/public/arcgis-assets')
    expect(mapStylesPlugin).toHaveBeenCalled()
    expect(InteractiveMap).toHaveBeenCalledWith('land-map', expect.objectContaining({
      plugins: expect.arrayContaining([expect.objectContaining({ id: 'mapStyles' })])
    }))

    const readyHandler = InteractiveMap._handlers['map:ready']
    expect(readyHandler).toBeDefined()

    await readyHandler({ map: {}, view: {} })

    expect(registerGridPlugin).toHaveBeenCalled()
    expect(registerLayersPanel).toHaveBeenCalled()
  })
})
