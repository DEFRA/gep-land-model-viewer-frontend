import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { toFeatureRecord, indexFeatures } from './data.js'

/**
 * @param {Partial<import('./data.js').RawParcel>} [overrides]
 * @returns {import('./data.js').RawParcel}
 */
function rawParcel (overrides = {}) {
  return {
    osid: 'a',
    toid: 't1',
    land_use_model_code: 'U011',
    land_use_model_display_text: 'Agriculture',
    land_cover_intersecting: { 'Improved grass': 82.2, Woodland: 17.8 },
    dominant_land_cover_model_display_text: 'Improved grass',
    dominant_land_cover_code: 'C021',
    land_cover_source: 'UKCEH LCM2024',
    land_cover_date: '28/04/2015',
    soil_intersecting: { 'Brown soils': 100 },
    dominant_soil_model_display_text: 'Brown soils',
    dominant_soil_code: 'S050',
    soil_source: 'Cranfield Soils Data',
    soil_date: '28/04/2026',
    ...overrides
  }
}

function okResponse (rows) {
  return vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(rows) }))
}

describe('#toFeatureRecord', () => {
  test('maps the unit and land use', () => {
    const record = toFeatureRecord(rawParcel())

    expect(record.unit).toEqual({ kind: 'feature', osid: 'a', toid: 't1' })
    expect(record.landUse).toEqual({ dominant: { label: 'Agriculture', code: 'U011' } })
  })

  test('maps intersections in source order and the dominant class', () => {
    const record = toFeatureRecord(rawParcel({ land_cover_intersecting: { Woodland: 17.8, 'Improved grass': 75.9 } }))

    expect(record.landCover.intersections).toEqual([
      { label: 'Woodland', percentage: 17.8 },
      { label: 'Improved grass', percentage: 75.9 }
    ])
    expect(record.landCover.dominant).toEqual({ label: 'Improved grass', code: 'C021' })
    expect(record.soils.intersections).toEqual([{ label: 'Brown soils', percentage: 100 }])
  })

  test('maps source metadata', () => {
    const record = toFeatureRecord(rawParcel())

    expect(record.landCover.source).toEqual({ name: 'UKCEH LCM2024', updated: new Date(2015, 3, 28) })
    expect(record.soils.source).toEqual({ name: 'Cranfield Soils Data', updated: new Date(2026, 3, 28) })
  })

  test('keeps the dominant class when there are no intersections', () => {
    const record = toFeatureRecord(rawParcel({ land_cover_intersecting: null }))
    expect(record.landCover.dominant).toEqual({ label: 'Improved grass', code: 'C021' })
    expect(record.landCover).not.toHaveProperty('intersections')
  })

  test('returns null for a theme without a dominant class', () => {
    const record = toFeatureRecord(rawParcel({ dominant_land_cover_model_display_text: null }))
    expect(record.landCover).toBeNull()
  })

  test('returns null for themes with no data', () => {
    const record = toFeatureRecord(rawParcel({ land_use_model_display_text: null, land_use_model_code: null, land_cover_intersecting: null, dominant_land_cover_model_display_text: null, soil_intersecting: null, dominant_soil_model_display_text: null }))

    for (const theme of ['landCover', 'landUse', 'ownership', 'landManagement', 'protectedAreas', 'soils']) {
      expect(record[theme]).toBeNull()
    }
  })
})

describe('#indexFeatures', () => {
  test('indexes records by OSID', () => {
    const byOsid = indexFeatures([rawParcel({ osid: 'a' }), rawParcel({ osid: 'b', toid: 't2' })])

    expect(byOsid.size).toBe(2)
    expect(byOsid.get('b').unit.toid).toBe('t2')
    expect(byOsid.get('a').landUse.dominant.label).toBe('Agriculture')
  })
})

describe('#getFeatureDetails', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('returns the mapped feature matching the osid', async () => {
    vi.stubGlobal('fetch', okResponse([rawParcel({ osid: 'b', toid: 't2' })]))
    const { getFeatureDetails } = await import('./data.js')

    const feature = await getFeatureDetails('b')

    expect(feature.unit.toid).toBe('t2')
    expect(feature.landCover.dominant.label).toBe('Improved grass')
  })

  test('returns null for an unknown osid', async () => {
    vi.stubGlobal('fetch', okResponse([rawParcel()]))
    const { getFeatureDetails } = await import('./data.js')

    expect(await getFeatureDetails('missing')).toBeNull()
  })

  test('fetches the file only once across lookups', async () => {
    const fetchMock = okResponse([rawParcel({ osid: 'a' }), rawParcel({ osid: 'b' })])
    vi.stubGlobal('fetch', fetchMock)
    const { getFeatureDetails } = await import('./data.js')

    await getFeatureDetails('a')
    await getFeatureDetails('b')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('does not cache a failed load, so the next lookup retries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([rawParcel()]) })
    vi.stubGlobal('fetch', fetchMock)
    const { getFeatureDetails } = await import('./data.js')

    await expect(getFeatureDetails('a')).rejects.toThrow()
    const feature = await getFeatureDetails('a')

    expect(feature.unit.toid).toBe('t1')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
