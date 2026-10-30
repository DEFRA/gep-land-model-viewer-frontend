import { describe, test, expect } from 'vitest'
import { toFeatureRecord } from './data.js'

const DATE = '2026-10-21T10:47:51.297Z'
const UPDATED = new Date(DATE)

const SOURCES = {
  land_cover: { name: 'UKCEH Land Cover Map', date: DATE },
  land_use: { name: 'OS NGD', date: DATE },
  soil: { name: 'National Soil Map', date: DATE },
  land_management: { name: 'RPA', date: DATE },
  ownership: { name: 'HM Land Registry', date: DATE },
  protected_area: { name: 'Natural England SSSI, SAC, SPA, Ramsar, NNR', date: DATE }
}

/**
 * @param {Partial<import('./data.js').ParcelProperties>} [overrides]
 * @returns {import('./data.js').ParcelProperties}
 */
function parcelProperties (overrides = {}) {
  return {
    osid: '18a31fc7-a2a3-441c-8bc5-403a016a2ebf',
    land_cover_dominant_value: 'Broad leaved & mixed woodland',
    land_cover_intersections_json: JSON.stringify([
      { mapped_value: 'Broad leaved & mixed woodland', intersection_area: 773.1, intersection_pct: 75.6 },
      { mapped_value: 'Improved grass', intersection_area: 249.4, intersection_pct: 24.4 }
    ]),
    land_use_dominant_value: 'Transport tracks and ways',
    land_use_intersections_json: JSON.stringify([
      { mapped_value: 'Transport tracks and ways', intersection_area: 1022.4680500023286, intersection_pct: 100.0 }
    ]),
    soil_dominant_value: 'Brown soils',
    soil_intersections_json: JSON.stringify([
      { mapped_value: 'Brown soils', intersection_area: 1022.5, intersection_pct: 100.0 }
    ]),
    protected_area_intersections_json: JSON.stringify([
      { code: '1003409', type: 'SSSI', name: 'Dalby Bush Fen SSSI', intersection_area: 767.9, intersection_pct: 75.1 }
    ]),
    land_management_intersections_json: JSON.stringify([
      { id: 107132256, intersection_area: 613.5, intersection_pct: 60 },
      { id: 107132257, intersection_area: 409, intersection_pct: 40 }
    ]),
    ownership_intersections_json: JSON.stringify([
      { id: 47540258, mapped_value: 'Freehold', intersection_area: 1022.5, intersection_pct: 100 }
    ]),
    ...overrides
  }
}

describe('#toFeatureRecord', () => {
  test('maps the unit and land use with its source from the release', () => {
    const record = toFeatureRecord(parcelProperties({ toid: 't1' }), SOURCES)

    expect(record.unit).toEqual({ kind: 'feature', osid: '18a31fc7-a2a3-441c-8bc5-403a016a2ebf', toid: 't1' })
    expect(record.landUse).toEqual({
      dominant: { label: 'Transport tracks and ways' },
      intersections: [{ label: 'Transport tracks and ways', percentage: 100 }],
      source: { name: 'OS NGD', updated: UPDATED }
    })
  })

  test('maps intersections in source order and takes the dominant class from its column', () => {
    const record = toFeatureRecord(parcelProperties({ land_cover_dominant_value: 'Improved grass' }), SOURCES)

    expect(record.landCover.intersections).toEqual([
      { label: 'Broad leaved & mixed woodland', percentage: 75.6 },
      { label: 'Improved grass', percentage: 24.4 }
    ])
    expect(record.landCover.dominant).toEqual({ label: 'Improved grass' })
    expect(record.soils.source).toEqual({ name: 'National Soil Map', updated: UPDATED })
  })

  test('maps protected areas to their sites', () => {
    const record = toFeatureRecord(parcelProperties(), SOURCES)

    expect(record.protectedAreas).toEqual({
      sites: [{
        code: '1003409',
        name: 'Dalby Bush Fen SSSI',
        designation: { label: 'SSSI' },
        intersection: { percentage: 75.1 }
      }],
      source: { name: 'Natural England SSSI, SAC, SPA, Ramsar, NNR', updated: UPDATED }
    })
  })

  test('maps ownership titles and land management records from their IDs', () => {
    const record = toFeatureRecord(parcelProperties(), SOURCES)

    expect(record.ownership).toEqual({
      titles: [{ inspireId: '47540258', titleDescriptor: 'Freehold' }],
      source: { name: 'HM Land Registry', updated: UPDATED }
    })
    expect(record.landManagement).toEqual({
      records: [{ pseudoSbi: '107132256' }, { pseudoSbi: '107132257' }],
      source: { name: 'RPA', updated: UPDATED }
    })
  })

  test('returns null for a theme with no intersections', () => {
    const record = toFeatureRecord(parcelProperties({ land_cover_dominant_value: null, land_cover_intersections_json: '[]' }))

    expect(record.landCover).toBeNull()
  })

  test('returns null for themes with no data', () => {
    const record = toFeatureRecord({ osid: 'a' })

    for (const theme of ['landCover', 'landUse', 'ownership', 'landManagement', 'protectedAreas', 'soils']) {
      expect(record[theme]).toBeNull()
    }
  })
})
