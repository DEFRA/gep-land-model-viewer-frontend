import { vi, describe, test, expect, afterEach } from 'vitest'

vi.mock('../../datasets/layers/wms.js', () => ({
  getSourceUrl: vi.fn(() => '/wms'),
  getVisibleWmsLayers: vi.fn(() => [])
}))

const { getVisibleWmsLayers } = await import('../../datasets/layers/wms.js')
const { UNKNOWN_LAYER_LABEL } = await import('../../constants.js')
const { getKeyEntries } = await import('./key-entries.js')

const DATASETS = [{ id: 'flood', label: 'Flood Zones' }]

function stubLayer (id, layerNames) {
  return {
    get: key => key === 'id' ? id : undefined,
    getSource: () => ({ getParams: () => layerNames ? { LAYERS: layerNames } : {} })
  }
}

const map = /** @type {import('ol/Map').default} */ (/** @type {unknown} */ ({}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('getKeyEntries', () => {
  test('lists every visible WMS layer', () => {
    vi.mocked(getVisibleWmsLayers).mockReturnValue([stubLayer('gep-flood', 'zone_2,zone_3')])

    expect(getKeyEntries(map, DATASETS)).toEqual([
      { label: 'Flood Zones', baseUrl: '/wms', layerNames: ['zone_2', 'zone_3'] }
    ])
    expect(getVisibleWmsLayers).toHaveBeenCalledWith(map)
  })

  test('leaves out a WMS layer without layer names', () => {
    vi.mocked(getVisibleWmsLayers).mockReturnValue([stubLayer('gep-flood')])

    expect(getKeyEntries(map, DATASETS)).toEqual([])
  })

  test('uses a generic label for an unrecognised layer', () => {
    vi.mocked(getVisibleWmsLayers).mockReturnValue([stubLayer('gep-mystery', 'x')])

    expect(getKeyEntries(map, DATASETS)[0].label).toBe(UNKNOWN_LAYER_LABEL)
  })
})
