import { describe, test, expect } from 'vitest'
import { toFeatureRecord } from './data.js'

/**
 * @param {Partial<import('./data.js').ParcelProperties>} [overrides]
 * @returns {import('./data.js').ParcelProperties}
 */
function parcelProperties (overrides = {}) {
  return {
    osid: 'a',
    toid: 't1',
    land_use_dom_code: 'U011',
    land_use_dom_name: 'Agriculture',
    land_use_source: 'OS NGD',
    land_use_date: '24/09/2024',
    land_cover_proportions: '{"Improved grass":82.2,"Woodland":17.8}',
    land_cover_dom_name: 'Improved grass',
    land_cover_dom_code: 'C021',
    land_cover_source: 'UKCEH LCM2024',
    land_cover_date: '2024',
    soil_proportions: '{"Brown soils":100}',
    soil_dom_name: 'Brown soils',
    soil_dom_code: 'S050',
    soil_source: 'Cranfield Soils Data',
    soil_date: '05/10/2023',
    ...overrides
  }
}

describe('#toFeatureRecord', () => {
  test('maps the unit and land use', () => {
    const record = toFeatureRecord(parcelProperties())

    expect(record.unit).toEqual({ kind: 'feature', osid: 'a', toid: 't1' })
    expect(record.landUse).toEqual({
      dominant: { label: 'Agriculture', code: 'U011' },
      source: { name: 'OS NGD', updated: new Date(2024, 8, 24) }
    })
  })

  test('maps intersections in source order and the dominant class', () => {
    const record = toFeatureRecord(parcelProperties({ land_cover_proportions: '{"Woodland":17.8,"Improved grass":75.9}' }))

    expect(record.landCover.intersections).toEqual([
      { label: 'Woodland', percentage: 17.8 },
      { label: 'Improved grass', percentage: 75.9 }
    ])
    expect(record.landCover.dominant).toEqual({ label: 'Improved grass', code: 'C021' })
    expect(record.soils.intersections).toEqual([{ label: 'Brown soils', percentage: 100 }])
  })

  test('maps source metadata', () => {
    const record = toFeatureRecord(parcelProperties())

    expect(record.landCover.source).toEqual({ name: 'UKCEH LCM2024', updated: new Date(2024, 0, 1) })
    expect(record.soils.source).toEqual({ name: 'Cranfield Soils Data', updated: new Date(2023, 9, 5) })
  })

  test('keeps the dominant class when there are no intersections', () => {
    const record = toFeatureRecord(parcelProperties({ land_cover_proportions: undefined }))
    expect(record.landCover.dominant).toEqual({ label: 'Improved grass', code: 'C021' })
    expect(record.landCover).not.toHaveProperty('intersections')
  })

  test('returns null for a theme without a dominant class', () => {
    const record = toFeatureRecord(parcelProperties({ land_cover_dom_name: undefined }))
    expect(record.landCover).toBeNull()
  })

  test('returns null for themes with no data', () => {
    const record = toFeatureRecord({ osid: 'a', toid: 't1' })

    for (const theme of ['landCover', 'landUse', 'ownership', 'landManagement', 'protectedAreas', 'soils']) {
      expect(record[theme]).toBeNull()
    }
  })
})
