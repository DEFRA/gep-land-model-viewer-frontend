// @vitest-environment jsdom
import { vi, describe, test, expect, afterEach } from 'vitest'

vi.mock('@defra/interactive-map', () => {
  const handlers = {}
  const MockInteractiveMap = Object.assign(vi.fn().mockImplementation(function () {
    this.on = vi.fn((event, handler) => { handlers[event] = handler })
    this._handlers = handlers
  }), { _handlers: handlers })
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

vi.mock('./config/datasets.js', () => ({
  datasets: [{ id: 'woodland', label: 'Ancient Woodland' }]
}))

describe('map entry point', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  // The entry point runs on first import, so its call is asserted in one test:
  // clearAllMocks between tests would drop it and the module is cached.
  test('creates the map with the OpenLayers provider and every plugin', async () => {
    const InteractiveMap = (await import('@defra/interactive-map')).default
    const { datasets } = await import('./config/datasets.js')
    const createOpenLayersProvider = (await import('@defra/interactive-map/providers/openlayers')).default
    const mapStylesPlugin = (await import('@defra/interactive-map/plugins/map-styles')).default
    const searchPlugin = (await import('@defra/interactive-map/plugins/search')).default

    await import('./index.js')

    expect(createOpenLayersProvider).toHaveBeenCalledWith({ zoomAlignment: 'uk' })
    expect(searchPlugin).toHaveBeenCalledWith(expect.objectContaining({
      osNamesURL: '/os/names/find?query={query}'
    }))
    expect(mapStylesPlugin).toHaveBeenCalled()

    const [id, options] = InteractiveMap.mock.calls[0]
    expect(id).toBe('land-map')
    expect(options).toMatchObject({
      mapProvider: { provider: 'openlayers' },
      mapStyle: { id: 'outdoor', label: 'Outdoor', url: '/style.json' },
      zoom: 7,
      minZoom: 0,
      maxZoom: 13
    })
    expect(options.plugins.map(plugin => plugin.id)).toEqual([
      'search',
      'mapStyles',
      'gepLayers',
      'gepNorthIndicator',
      'gepInfoLinks'
    ])
    const layersPlugin = options.plugins.find(plugin => plugin.id === 'gepLayers')
    expect(layersPlugin.datasets).toBe(datasets)
    expect(layersPlugin.infoPanel).toBeUndefined()
  })

  test('constrains resolution and restores double-click zoom once the map is ready', async () => {
    const InteractiveMap = (await import('@defra/interactive-map')).default

    await import('./index.js')

    const readyHandler = InteractiveMap._handlers['map:ready']
    expect(readyHandler).toBeDefined()

    const DoubleClickZoom = (await import('ol/interaction/DoubleClickZoom.js')).default
    const setConstrainResolution = vi.fn()
    const olMap = {
      getView: vi.fn(() => ({ setConstrainResolution })),
      addInteraction: vi.fn()
    }
    await readyHandler({ map: olMap })

    expect(setConstrainResolution).toHaveBeenCalledWith(true)
    expect(olMap.addInteraction).toHaveBeenCalledWith(expect.any(DoubleClickZoom))
  })
})
