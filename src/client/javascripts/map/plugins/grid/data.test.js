import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { toGridCell, indexGrids } from './data.js'

function testLookups () {
  return {
    land_use: ['Agriculture', 'Dwellings'],
    land_use_code: ['U011', 'U071'],
    land_cover: ['Cropped land', 'Improved grass'],
    land_cover_code: ['C010', 'C021'],
    soil: ['Surface-water gley soils', 'Brown soils'],
    soil_code: ['S070', 'S050'],
    aspect_aspect: ['EAST', 'SOUTH', 'FLAT', 'ERROR']
  }
}

function compactRow (overrides = {}) {
  const row = ['SE60007003', 1, 0, 0, 1, 1, 0, 42.3, 50.01, 50.11, 0.1, 0.5, 1.5, 1]
  for (const [index, value] of Object.entries(overrides)) {
    row[Number.parseInt(index)] = value
  }
  return row
}

function okResponse (data) {
  return vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(data) }))
}

function testMetadata () {
  return {
    land_cover_source: 'UKCEH LCM2024',
    land_cover_date: '28/04/2015',
    soil_source: 'Cranfield Soils Data',
    soil_date: '28/04/2026',
    topography_source: 'LIDAR Composite Digital Terrain Model (DTM) 1m',
    topography_date: '08/03/2023'
  }
}

function parsedMetadata () {
  return {
    landCover: { source: 'UKCEH LCM2024', date: new Date(2015, 3, 28) },
    soil: { source: 'Cranfield Soils Data', date: new Date(2026, 3, 28) },
    topography: { source: 'LIDAR Composite Digital Terrain Model (DTM) 1m', date: new Date(2023, 2, 8) }
  }
}

function wireFormat (rows = [compactRow()]) {
  return { metadata: testMetadata(), lookups: testLookups(), rows }
}

describe('#toGridCell', () => {
  const metadata = parsedMetadata()

  test('maps the compact row and lookups into the internal shape', () => {
    const cell = toGridCell(compactRow(), testLookups(), metadata)

    expect(cell.bngRef).toBe('SE60007003')
    expect(cell.landUse).toEqual({ label: 'Dwellings', code: 'U011' })
    expect(cell.landCover.label).toBe('Cropped land')
    expect(cell.landCover.code).toBe('C021')
    expect(cell.soil.label).toBe('Brown soils')
    expect(cell.soil.code).toBe('S070')
  })

  test('includes source and date metadata from the dataset', () => {
    const cell = toGridCell(compactRow(), testLookups(), metadata)

    expect(cell.landCover.source).toBe('UKCEH LCM2024')
    expect(cell.landCover.date).toEqual(new Date(2015, 3, 28))
    expect(cell.soil.source).toBe('Cranfield Soils Data')
    expect(cell.topography.source).toBe('LIDAR Composite Digital Terrain Model (DTM) 1m')
    expect(cell.topography.date).toEqual(new Date(2023, 2, 8))
  })

  test('resolves null indices to null values', () => {
    const cell = toGridCell(compactRow({ 1: null, 2: null }), testLookups(), metadata)

    expect(cell.landUse).toEqual({ label: null, code: null })
  })

  test('maps elevation, slope, and aspect fields', () => {
    const cell = toGridCell(compactRow(), testLookups(), metadata)

    expect(cell.elevation).toEqual({ min: 42.3, mean: 50.01, max: 50.11, mode: null })
    expect(cell.slope).toEqual({ min: 0.1, mode: 0.5, max: 1.5, mean: null })
    expect(cell.aspect).toEqual({ label: 'SOUTH', mean: null })
  })

  test('maps ERROR aspect label to null', () => {
    const cell = toGridCell(compactRow({ 13: 3 }), testLookups(), metadata)

    expect(cell.aspect.label).toBeNull()
  })
})

describe('#indexGrids', () => {
  test('keys rows by bng_ref in a Map', () => {
    const second = compactRow({ 0: 'SE60017003' })
    const { byBngRef } = indexGrids(wireFormat([compactRow(), second]))

    expect(byBngRef.size).toBe(2)
    expect(byBngRef.get('SE60017003')).toBe(second)
  })

  test('parses date strings in the metadata', () => {
    const { metadata } = indexGrids(wireFormat())

    expect(metadata.landCover.date).toEqual(new Date(2015, 3, 28))
    expect(metadata.soil.date).toEqual(new Date(2026, 3, 28))
    expect(metadata.topography.date).toEqual(new Date(2023, 2, 8))
  })
})

describe('#getGridDetails', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('returns the hydrated grid cell matching the bng_ref', async () => {
    vi.stubGlobal('fetch', okResponse(wireFormat()))
    const { getGridDetails } = await import('./data.js')

    const cell = await getGridDetails('SE60007003')

    expect(cell.bngRef).toBe('SE60007003')
    expect(cell.landUse.label).toBe('Dwellings')
  })

  test('returns null for an unknown bng_ref', async () => {
    vi.stubGlobal('fetch', okResponse(wireFormat()))
    const { getGridDetails } = await import('./data.js')

    expect(await getGridDetails('XX00000000')).toBeNull()
  })

  test('fetches the file only once across lookups', async () => {
    const second = compactRow({ 0: 'SE60017003' })
    const fetchMock = okResponse(wireFormat([compactRow(), second]))
    vi.stubGlobal('fetch', fetchMock)
    const { getGridDetails } = await import('./data.js')

    await getGridDetails('SE60007003')
    await getGridDetails('SE60017003')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('does not cache a failed load, so the next lookup retries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(wireFormat()) })
    vi.stubGlobal('fetch', fetchMock)
    const { getGridDetails } = await import('./data.js')

    await expect(getGridDetails('SE60007003')).rejects.toThrow()
    const cell = await getGridDetails('SE60007003')

    expect(cell.landUse.label).toBe('Dwellings')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
