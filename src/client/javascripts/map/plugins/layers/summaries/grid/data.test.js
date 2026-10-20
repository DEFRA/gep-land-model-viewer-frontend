import { describe, test, expect, vi } from 'vitest'

vi.mock('./cell-values.js', () => ({ readCellValues: vi.fn() }))
vi.mock('./cell-properties.js', () => ({ readCellProperties: vi.fn() }))

const { readCellValues } = await import('./cell-values.js')
const { readCellProperties } = await import('./cell-properties.js')
const { toGridRecord, getGridDetails } = await import('./data.js')

const UNIT = { kind: 'grid', bngRef: 'SE60007003', cellSize: 10 }
const COARSE_UNIT = { kind: 'grid', bngRef: 'SE699700', cellSize: 100 }

function testBands () {
  return {
    landCover: {
      source: { name: 'UKCEH LCM2024', date: '2024' },
      fields: {
        dominant: {
          band: 1,
          classes: [
            { bandValue: 1, code: 'C010', label: 'Cropped land' },
            { bandValue: 2, code: 'C021', label: 'Improved grass' }
          ]
        }
      }
    },
    landUse: {
      source: { name: 'OS NGD', date: '24/09/2024' },
      fields: {
        dominant: {
          band: 2,
          classes: [
            { bandValue: 1, code: 'U011', label: 'Agriculture' },
            { bandValue: 2, code: 'U071', label: 'Dwellings' }
          ]
        }
      }
    },
    soils: {
      source: { name: 'Cranfield Soils Data', date: '05/10/2023' },
      fields: {
        dominant: {
          band: 3,
          classes: [
            { bandValue: 1, code: 'S050', label: 'Brown soils' },
            { bandValue: 2, code: 'S070', label: 'Surface-water gley soils' }
          ]
        }
      }
    },
    ownership: {
      source: { name: 'HM Land Registry' },
      fields: {
        inspireId: { band: 4 },
        titleDescriptor: { band: 5, classes: [{ bandValue: 1, label: 'Freehold' }, { bandValue: 2, label: 'Leasehold' }] }
      }
    },
    landManagement: { source: { name: 'RPA', date: '2022' }, fields: { pseudoSbi: { band: 6 } } },
    protectedAreas: { source: { name: 'Natural England / JNCC', date: '2025' }, fields: { count: { band: 7 } } }
  }
}

function testProperties () {
  return {
    bng_ref: 'SE699700',
    land_cover_dom_code: 'C021',
    land_cover_dom_name: 'Improved grass',
    land_cover_proportions: '{"Improved grass":76,"Cropped land":24}',
    land_cover_source: 'UKCEH LCM2024',
    land_cover_date: '2024',
    land_use_dom_code: 'U011',
    land_use_dom_name: 'Agriculture',
    land_use_proportions: '{"Agriculture":82.5}'
  }
}

describe('#toGridRecord', () => {
  test('maps class labels and codes', () => {
    const record = toGridRecord(UNIT, [2, 2, 1], testBands())

    expect(record.unit).toBe(UNIT)
    expect(record.landUse.dominant).toEqual({ label: 'Dwellings', code: 'U071' })
    expect(record.landCover.dominant).toEqual({ label: 'Improved grass', code: 'C021' })
    expect(record.soils.dominant).toEqual({ label: 'Brown soils', code: 'S050' })
  })

  test('maps source metadata', () => {
    const record = toGridRecord(UNIT, [1, 1, 1], testBands())

    expect(record.landCover.source).toEqual({ name: 'UKCEH LCM2024', updated: new Date(2024, 0, 1) })
    expect(record.landUse.source).toEqual({ name: 'OS NGD', updated: new Date(2024, 8, 24) })
    expect(record.soils.source).toEqual({ name: 'Cranfield Soils Data', updated: new Date(2023, 9, 5) })
  })

  test('takes the INSPIRE ID, pseudo SBI and protected area count from their bands\' values', () => {
    const record = toGridRecord(UNIT, [1, 1, 1, 47540258, 2, 107132256, 2], testBands())

    expect(record.ownership).toEqual({ titles: [{ inspireId: '47540258', titleDescriptor: 'Leasehold' }], source: { name: 'HM Land Registry' } })
    expect(record.landManagement).toEqual({ records: [{ pseudoSbi: '107132256' }], source: { name: 'RPA', updated: new Date(2022, 0, 1) } })
    expect(record.protectedAreas).toEqual({ count: 2, source: { name: 'Natural England / JNCC', updated: new Date(2025, 0, 1) } })
  })

  test('has no ownership titles, pseudo SBIs or protected areas where their bands are 0', () => {
    const record = toGridRecord(UNIT, [1, 1, 1, 0, 0, 0, 0], testBands())

    expect(record.ownership.titles).toEqual([])
    expect(record.landManagement.records).toEqual([])
    expect(record.protectedAreas.count).toBe(0)
  })

  test('returns null for themes with no data', () => {
    const { ownership, landManagement, protectedAreas, ...bands } = testBands()
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
    fgbs: { 100: '/api/land-model/grid/layer/assets/100.fgb?v=2', 1000: '/api/land-model/grid/layer/assets/1000.fgb?v=3' }
  }
  const extent = [460000, 470030, 460010, 470040]
  const coarseExtent = [469900, 470000, 470000, 470100]

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

  test('reads a coarser cell from the FGB for its size', async () => {
    readCellProperties.mockResolvedValue(testProperties())

    const record = await getGridDetails(COARSE_UNIT, coarseExtent, source)

    expect(readCellProperties).toHaveBeenCalledWith(source.fgbs[100], 'SE699700', coarseExtent)
    expect(record.unit).toBe(COARSE_UNIT)
    expect(record.landCover).toEqual({
      dominant: { label: 'Improved grass', code: 'C021' },
      intersections: [{ label: 'Improved grass', percentage: 76 }, { label: 'Cropped land', percentage: 24 }],
      source: { name: 'UKCEH LCM2024', updated: new Date(2024, 0, 1) }
    })
    expect(record.landUse.intersections).toEqual([{ label: 'Agriculture', percentage: 82.5 }])
    expect(record.soils).toBeNull()
  })

  test('returns null when the FGB has no point for the cell', async () => {
    readCellProperties.mockResolvedValue(null)

    await expect(getGridDetails(COARSE_UNIT, coarseExtent, source)).resolves.toBeNull()
  })
})
