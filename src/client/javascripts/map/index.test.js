// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach } from 'vitest'

vi.mock('@defra/interactive-map', () => {
  const MockInteractiveMap = vi.fn().mockImplementation(function () {
    this.on = vi.fn()
  })
  return {
    default: MockInteractiveMap
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
})
