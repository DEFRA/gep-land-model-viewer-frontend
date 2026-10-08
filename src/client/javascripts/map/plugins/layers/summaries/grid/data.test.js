import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { toGridRecord, indexGrids } from './data.js'

function testLookups () {
  return {
    land_use: ['Agriculture', 'Dwellings'],
    land_use_code: ['U011', 'U071'],
    land_cover: ['Cropped land', 'Improved grass'],
    land_cover_code: ['C010', 'C021'],
    soil: ['Surface-water gley soils', 'Brown soils'],
    soil_code: ['S070', 'S050']
  }
}

function compactRow (overrides = {}) {
  const row = ['SE60007003', 1, 0, 0, 1, 1, 0]
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
    soil_date: '28/04/2026'
  }
}

function wireFormat (rows = [compactRow()]) {
  return { metadata: testMetadata(), lookups: testLookups(), rows }
}

describe('#toGridRecord', () => {
  test('maps lookup labels and codes, including index 0', () => {
    const { metadata, lookups } = indexGrids(wireFormat())
    const summary = toGridRecord(compactRow(), lookups, metadata)

    expect(summary.unit).toEqual({ kind: 'grid', bngRef: 'SE60007003', cellSize: 10 })
    expect(summary.landUse.dominant).toEqual({ label: 'Dwellings', code: 'U011' })
    expect(summary.landCover.dominant).toEqual({ label: 'Cropped land', code: 'C021' })
    expect(summary.soils.dominant).toEqual({ label: 'Brown soils', code: 'S070' })
  })

  test('maps source metadata', () => {
    const { metadata, lookups } = indexGrids(wireFormat())
    const record = toGridRecord(compactRow(), lookups, metadata)

    expect(record.landCover.source).toEqual({ name: 'UKCEH LCM2024', updated: new Date(2015, 3, 28) })
    expect(record.soils.source).toEqual({ name: 'Cranfield Soils Data', updated: new Date(2026, 3, 28) })
    expect(record.landUse).not.toHaveProperty('source')
  })

  test('returns null for themes with no data', () => {
    const { metadata, lookups } = indexGrids(wireFormat())
    const record = toGridRecord(compactRow({ 1: null, 2: null }), lookups, metadata)

    for (const key of ['landUse', 'ownership', 'landManagement', 'protectedAreas']) {
      expect(record[key]).toBeNull()
    }
  })
})

describe('#indexGrids', () => {
  test('indexes rows by BNG reference', () => {
    const second = compactRow({ 0: 'SE60017003' })
    const { byBngRef } = indexGrids(wireFormat([compactRow(), second]))

    expect(byBngRef.size).toBe(2)
    expect(byBngRef.get('SE60017003')).toBe(second)
  })
})

describe('#getGridDetails', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('returns the record matching the BNG reference', async () => {
    vi.stubGlobal('fetch', okResponse(wireFormat()))
    const { getGridDetails } = await import('./data.js')

    const cell = await getGridDetails('SE60007003')

    expect(cell.unit.bngRef).toBe('SE60007003')
    expect(cell.landUse.dominant.label).toBe('Dwellings')
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

    expect(cell.landUse.dominant.label).toBe('Dwellings')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
