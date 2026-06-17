import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { toParcel, indexParcels } from './data.js'

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
    elevation_min: 42,
    elevation_mean: 42,
    elevation_mode: null,
    elevation_max: 43.69,
    slope_min: 0.2,
    slope_mean: null,
    slope_mode: 2.8,
    slope_max: 28,
    aspect_mean: 147.83,
    aspect_aspect: 'SOUTH',
    ...overrides
  }
}

function okResponse (rows) {
  return vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(rows) }))
}

describe('#toParcel', () => {
  test('maps the wire shape into the internal shape', () => {
    const parcel = toParcel(rawParcel())

    expect(parcel.osid).toBe('a')
    expect(parcel.toid).toBe('t1')
    expect(parcel.landUse).toEqual({ label: 'Agriculture', code: 'U011' })
    expect(parcel.landCover.dominantLabel).toBe('Improved grass')
    expect(parcel.aspect).toEqual({ mean: 147.83, label: 'SOUTH' })
  })

  test('sorts the composition breakdown by descending percentage', () => {
    const { breakdown } = toParcel(rawParcel()).landCover

    expect(breakdown).toEqual([
      { label: 'Improved grass', percentage: 82.2 },
      { label: 'Woodland', percentage: 17.8 }
    ])
  })

  test('flags isMixed when a category spans more than one value', () => {
    const parcel = toParcel(rawParcel())

    expect(parcel.landCover.isMixed).toBe(true)
    expect(parcel.soil.isMixed).toBe(false)
  })

  test('parses dd/mm/yyyy dates to Date objects and nulls unparseable ones', () => {
    expect(toParcel(rawParcel()).landCover.date).toEqual(new Date(2015, 3, 28))
    expect(toParcel(rawParcel({ land_cover_date: 'unknown' })).landCover.date).toBeNull()
  })

  test('maps elevation and slope values from the wire format', () => {
    const parcel = toParcel(rawParcel())

    expect(parcel.elevation).toEqual({ min: 42, mean: 42, mode: null, max: 43.69 })
    expect(parcel.slope).toEqual({ min: 0.2, mean: null, mode: 2.8, max: 28 })
  })

  test('maps the shared topography metadata from constants', () => {
    const parcel = toParcel(rawParcel())

    expect(parcel.topography.source).toBe('LIDAR Composite Digital Terrain Model (DTM) 1m')
    expect(parcel.topography.date).toEqual(new Date(2023, 2, 8))
  })

  test('returns null when the date field is missing', () => {
    const parcel = toParcel(rawParcel({ land_cover_date: null }))

    expect(parcel.landCover.date).toBeNull()
  })

  test('maps null intersecting fields to empty breakdowns', () => {
    const parcel = toParcel(rawParcel({
      land_cover_intersecting: null,
      soil_intersecting: null
    }))

    expect(parcel.landCover.isMixed).toBe(false)
    expect(parcel.landCover.breakdown).toEqual([])
    expect(parcel.soil.isMixed).toBe(false)
    expect(parcel.soil.breakdown).toEqual([])
  })

  test('maps ERROR aspect label to null', () => {
    const parcel = toParcel(rawParcel({ aspect_aspect: 'ERROR' }))

    expect(parcel.aspect.label).toBeNull()
  })

  test('maps elevation mode and slope mean once the upstream provides them', () => {
    const parcel = toParcel(rawParcel({ elevation_mode: 80, slope_mean: 3.5 }))

    expect(parcel.elevation.mode).toBe(80)
    expect(parcel.slope.mean).toBe(3.5)
  })
})

describe('#indexParcels', () => {
  test('keys mapped parcels by osid', () => {
    const byOsid = indexParcels([rawParcel({ osid: 'a' }), rawParcel({ osid: 'b', toid: 't2' })])

    expect(byOsid.size).toBe(2)
    expect(byOsid.get('b').toid).toBe('t2')
    expect(byOsid.get('a').landUse.label).toBe('Agriculture')
  })
})

describe('#getFeatureDetails', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('returns the mapped parcel matching the osid', async () => {
    vi.stubGlobal('fetch', okResponse([rawParcel({ osid: 'b', toid: 't2' })]))
    const { getFeatureDetails } = await import('./data.js')

    const parcel = await getFeatureDetails('b')

    expect(parcel.toid).toBe('t2')
    expect(parcel.landCover.dominantLabel).toBe('Improved grass')
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
    const parcel = await getFeatureDetails('a')

    expect(parcel.toid).toBe('t1')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
