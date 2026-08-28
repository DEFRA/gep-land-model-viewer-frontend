import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('./layers/cog.js', () => ({ createCogLayer: vi.fn() }))
vi.mock('./layers/fgb.js', () => ({ createFlatGeobufLayers: vi.fn() }))
vi.mock('./layers/wms.js', () => ({ createWmsLayer: vi.fn() }))

const { createCogLayer } = await import('./layers/cog.js')
const { createFlatGeobufLayers } = await import('./layers/fgb.js')
const { createWmsLayer } = await import('./layers/wms.js')
const { toggleDataset } = await import('./layer-manager.js')

const WOODLAND = { id: 'woodland', label: 'Ancient Woodland', source: { type: 'fgb', url: '/woodland.fgb', attribution: 'Natural England' } }
const PEAT = { id: 'peat', label: 'Peaty Soils', source: { type: 'cog', url: '/peat.tif' } }
const FLOOD = { id: 'flood', label: 'Flood Zones', source: { type: 'wms', url: '/wms', attribution: 'Environment Agency' } }

/** @returns {any} */
function stubLayer (id, { minZoom = -Infinity, visible = true } = {}) {
  return {
    get: (key) => (key === 'id' ? id : undefined),
    getMinZoom: () => minZoom,
    getVisible: () => visible,
    setVisible: vi.fn()
  }
}

function createMap (layers = []) {
  const list = [...layers]
  return /** @type {import('ol/Map').default} */ (/** @type {unknown} */ ({
    getLayers: () => ({ getArray: () => list }),
    addLayer: vi.fn(layer => list.push(layer))
  }))
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('dataset layers', () => {
  test('turning a dataset on builds its layers and reports it visible', async () => {
    const map = createMap()
    vi.mocked(createFlatGeobufLayers).mockResolvedValue([stubLayer('gep-woodland')])

    const result = await toggleDataset(map, WOODLAND, true)

    expect(createFlatGeobufLayers).toHaveBeenCalledWith(WOODLAND, 'gep-woodland', map)
    expect(map.addLayer).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ visible: true, minZoom: undefined })
  })

  test('a COG dataset builds a single layer', async () => {
    const map = createMap()
    vi.mocked(createCogLayer).mockResolvedValue(stubLayer('gep-peat'))

    await toggleDataset(map, PEAT, true)

    expect(createCogLayer).toHaveBeenCalledWith(PEAT, 'gep-peat')
    expect(map.addLayer).toHaveBeenCalledTimes(1)
  })

  test('a WMS dataset that yields no layer stays off', async () => {
    const map = createMap()
    vi.mocked(createWmsLayer).mockResolvedValue(null)

    const result = await toggleDataset(map, FLOOD, true)

    expect(map.addLayer).not.toHaveBeenCalled()
    expect(result.visible).toBe(false)
  })

  test('an unknown source type adds nothing', async () => {
    const map = createMap()

    const result = await toggleDataset(map, { id: 'odd', label: 'Odd', source: { type: 'geojson' } }, true)

    expect(map.addLayer).not.toHaveBeenCalled()
    expect(result.visible).toBe(false)
  })

  test('a layer that fails to load is logged and reported as off', async () => {
    const map = createMap()
    vi.mocked(createFlatGeobufLayers).mockImplementation(() => { throw new Error('bad file') })

    const result = await toggleDataset(map, WOODLAND, true)

    expect(console.error).toHaveBeenCalledWith('Failed to load data layer woodland', expect.any(Error))
    expect(result.visible).toBe(false)
  })

  test('toggling an existing dataset reuses its layers', async () => {
    const detail = stubLayer('gep-woodland')
    const overview = stubLayer('gep-woodland-overview')
    const map = createMap([detail, overview])

    await toggleDataset(map, WOODLAND, false)

    expect(detail.setVisible).toHaveBeenCalledWith(false)
    expect(overview.setVisible).toHaveBeenCalledWith(false)
    expect(createFlatGeobufLayers).not.toHaveBeenCalled()
  })

  test('turning a dataset off that was never built does nothing', async () => {
    const map = createMap()

    const result = await toggleDataset(map, WOODLAND, false)

    expect(map.addLayer).not.toHaveBeenCalled()
    expect(result).toEqual({ visible: false, minZoom: undefined })
  })

  test('a dataset drawn only above a zoom reports that floor', async () => {
    const map = createMap([stubLayer('gep-woodland', { minZoom: 8 })])

    const result = await toggleDataset(map, WOODLAND, true)

    expect(result.minZoom).toBe(9)
  })

  test('a dataset with an overview has no zoom floor', async () => {
    const map = createMap([
      stubLayer('gep-woodland', { minZoom: 8 }),
      stubLayer('gep-woodland-overview')
    ])

    const result = await toggleDataset(map, WOODLAND, true)

    expect(result.minZoom).toBeUndefined()
  })

  test('an overview is sufficient for a dataset to be shown', async () => {
    const map = createMap([stubLayer('gep-woodland-overview')])

    const result = await toggleDataset(map, WOODLAND, true)

    expect(result).toEqual({ visible: true, minZoom: undefined })
  })
})
