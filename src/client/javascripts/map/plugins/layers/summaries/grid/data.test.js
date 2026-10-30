import { describe, test, expect, vi } from 'vitest'

vi.mock('./cell-values.js', () => ({ readCellValues: vi.fn() }))
vi.mock('./cell-properties.js', () => ({ readCellProperties: vi.fn() }))

const { readCellValues } = await import('./cell-values.js')
const { readCellProperties } = await import('./cell-properties.js')
const { toGridRecord, getGridDetails } = await import('./data.js')

const UNIT = { kind: 'grid', bngRef: 'SE60007003', cellSize: 10 }
const COARSE_UNIT = { kind: 'grid', bngRef: 'SE643715', cellSize: 100 }

const DATE = '2026-10-21T11:16:39.058Z'
const UPDATED = new Date(DATE)

const SOURCES = {
  land_cover: { name: 'UKCEH Land Cover Map', date: DATE },
  land_use: { name: 'OS NGD', date: DATE },
  soil: { name: 'National Soil Map', date: DATE },
  land_management: { name: 'RPA', date: DATE },
  ownership: { name: 'HM Land Registry', date: DATE },
  protected_area: { name: 'Natural England SSSI, SAC, SPA, Ramsar, NNR', date: DATE }
}

function testBands () {
  return {
    land_cover_dominant_value: {
      band: 1,
      classes: [{ bandValue: 1, label: 'Cropped land' }, { bandValue: 2, label: 'Improved grass' }]
    },
    land_use_dominant_value: {
      band: 2,
      classes: [{ bandValue: 1, label: 'Agriculture' }, { bandValue: 2, label: 'Dwellings' }]
    },
    soil_dominant_value: {
      band: 3,
      classes: [{ bandValue: 1, label: 'Brown soils' }, { bandValue: 2, label: 'Surface-water gley soils' }]
    },
    ownership_dominant_id: { band: 4 },
    ownership_dominant_value: {
      band: 5,
      classes: [{ bandValue: 1, label: 'Freehold' }, { bandValue: 2, label: 'Leasehold' }]
    },
    land_management_dominant_id: { band: 6 },
    protected_area_count: { band: 7 }
  }
}

function testProperties () {
  return {
    bng_ref: 'SE643715',
    land_cover_intersections_json: JSON.stringify([
      { mapped_value: 'Improved grass', intersection_area: 4238.4, intersection_pct: 42.4 },
      { mapped_value: 'Broad leaved & mixed woodland', intersection_area: 5761.6, intersection_pct: 57.6 }
    ]),
    land_use_intersections_json: JSON.stringify([
      { mapped_value: 'Agriculture', intersection_area: 4139.0, intersection_pct: 41.4 },
      { mapped_value: 'Unused land', intersection_area: 5861.0, intersection_pct: 58.6 }
    ]),
    soil_intersections_json: JSON.stringify([
      { mapped_value: 'Brown soils', intersection_area: 10000.0, intersection_pct: 100.0 }
    ]),
    protected_area_count: 1
  }
}

describe('#toGridRecord', () => {
  test('maps the dominant class labels', () => {
    const record = toGridRecord(UNIT, [2, 2, 1], testBands())

    expect(record.unit).toBe(UNIT)
    expect(record.landUse).toEqual({ dominant: { label: 'Dwellings' } })
    expect(record.landCover).toEqual({ dominant: { label: 'Improved grass' } })
    expect(record.soils).toEqual({ dominant: { label: 'Brown soils' } })
  })

  test('maps each theme\'s source from the release', () => {
    const record = toGridRecord(UNIT, [1, 1, 1], testBands(), SOURCES)

    expect(record.landCover.source).toEqual({ name: 'UKCEH Land Cover Map', updated: UPDATED })
    expect(record.landUse.source).toEqual({ name: 'OS NGD', updated: UPDATED })
    expect(record.soils.source).toEqual({ name: 'National Soil Map', updated: UPDATED })
  })

  test('takes the INSPIRE ID, pseudo SBI and protected area count from their bands\' values', () => {
    const record = toGridRecord(UNIT, [1, 1, 1, 47540258, 2, 107132256, 2], testBands(), SOURCES)

    expect(record.ownership).toEqual({ titles: [{ inspireId: '47540258', titleDescriptor: 'Leasehold' }], source: { name: 'HM Land Registry', updated: UPDATED } })
    expect(record.landManagement).toEqual({ records: [{ pseudoSbi: '107132256' }], source: { name: 'RPA', updated: UPDATED } })
    expect(record.protectedAreas).toEqual({ count: 2, source: { name: 'Natural England SSSI, SAC, SPA, Ramsar, NNR', updated: UPDATED } })
  })

  test('has no ownership titles, pseudo SBIs or protected areas where their bands are 0', () => {
    const record = toGridRecord(UNIT, [1, 1, 1, 0, 0, 0, 0], testBands())

    expect(record.ownership.titles).toEqual([])
    expect(record.landManagement.records).toEqual([])
    expect(record.protectedAreas.count).toBe(0)
  })

  test('returns null for themes with no data', () => {
    const dominantValues = ['land_cover_dominant_value', 'land_use_dominant_value', 'soil_dominant_value']
    const bands = Object.fromEntries(Object.entries(testBands()).filter(([column]) => dominantValues.includes(column)))
    const record = toGridRecord(UNIT, [1, 0, 1], bands)

    for (const key of ['landUse', 'ownership', 'landManagement', 'protectedAreas']) {
      expect(record[key]).toBeNull()
    }
  })
})

describe('#getGridDetails', () => {
  const source = {
    url: '/api/land-model/grid/layer/assets/10.tif?v=1',
    bands: testBands(),
    dataSources: SOURCES,
    fgbs: { 100: '/api/land-model/grid/layer/assets/100.fgb?v=2', 1000: '/api/land-model/grid/layer/assets/1000.fgb?v=3' }
  }
  const extent = [460000, 470030, 460010, 470040]
  const coarseExtent = [464300, 471500, 464400, 471600]

  test('reads a 10m cell from the COG', async () => {
    readCellValues.mockResolvedValue([1, 2, 1])

    const record = await getGridDetails(UNIT, extent, source)

    expect(readCellValues).toHaveBeenCalledWith(source.url, extent)
    expect(record.landUse.dominant.label).toBe('Dwellings')
  })

  test('returns null beyond the COG', async () => {
    readCellValues.mockResolvedValue(null)

    await expect(getGridDetails(UNIT, extent, source)).resolves.toBeNull()
  })

  test('reads a coarser cell from the FGB for its size and takes its largest class as dominant', async () => {
    readCellProperties.mockResolvedValue(testProperties())

    const record = await getGridDetails(COARSE_UNIT, coarseExtent, source)

    expect(readCellProperties).toHaveBeenCalledWith(source.fgbs[100], 'SE643715', coarseExtent)
    expect(record.unit).toBe(COARSE_UNIT)
    expect(record.landCover).toEqual({
      dominant: { label: 'Broad leaved & mixed woodland' },
      intersections: [{ label: 'Improved grass', percentage: 42.4 }, { label: 'Broad leaved & mixed woodland', percentage: 57.6 }],
      source: { name: 'UKCEH Land Cover Map', updated: UPDATED }
    })
    expect(record.landUse.dominant).toEqual({ label: 'Unused land' })
    expect(record.soils.intersections).toEqual([{ label: 'Brown soils', percentage: 100 }])
  })

  test('takes a coarser cell\'s protected area count from its column', async () => {
    readCellProperties.mockResolvedValue(testProperties())

    const record = await getGridDetails(COARSE_UNIT, coarseExtent, source)

    expect(record.protectedAreas).toEqual({ count: 1, source: { name: 'Natural England SSSI, SAC, SPA, Ramsar, NNR', updated: UPDATED } })
  })

  test('returns null when the FGB has no point for the cell', async () => {
    readCellProperties.mockResolvedValue(null)

    await expect(getGridDetails(COARSE_UNIT, coarseExtent, source)).resolves.toBeNull()
  })
})
