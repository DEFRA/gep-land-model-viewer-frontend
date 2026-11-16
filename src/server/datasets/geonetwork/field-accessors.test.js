import {
  allDefaults,
  datedEntry,
  firstDatedEntry,
  firstDefault,
  firstNestedCode,
  mappedValue,
  objectDefault,
  rawArray,
  resolution
} from './field-accessors.js'

describe('#field-accessors', () => {
  describe('objectDefault', () => {
    test('returns the default value from a GeoNetwork multilingual object', () => {
      expect(objectDefault('resourceTitleObject')({
        resourceTitleObject: { default: 'Test Title' }
      })).toBe('Test Title')
    })

    test('returns the configured fallback when the field is missing', () => {
      expect(objectDefault('resourceTitleObject', '')({})).toBe('')
    })
  })

  describe('firstDefault', () => {
    test('returns the default value from the first array entry', () => {
      expect(firstDefault('cl_maintenanceAndUpdateFrequency')({
        cl_maintenanceAndUpdateFrequency: [{ default: 'Monthly' }]
      })).toBe('Monthly')
    })

    test('returns null when the field is missing', () => {
      expect(firstDefault('cl_maintenanceAndUpdateFrequency')({})).toBeNull()
    })
  })

  describe('mappedValue', () => {
    test('maps a raw source value to its display value', () => {
      const accessLevel = mappedValue('isOpenData', {
        true: 'Open data',
        false: 'Restricted access'
      })

      expect(accessLevel({ isOpenData: 'true' })).toBe('Open data')
    })

    test('returns null when the raw value is missing from the map', () => {
      const accessLevel = mappedValue('isOpenData', {
        true: 'Open data',
        false: 'Restricted access'
      })

      expect(accessLevel({ isOpenData: 'unknown' })).toBeNull()
    })
  })

  describe('firstDatedEntry', () => {
    const updatedAt = firstDatedEntry('resourceDate', ['revision', 'publication'])

    test('prefers the first type even when a later type is more recent', () => {
      expect(updatedAt({
        resourceDate: [
          { type: 'creation', date: '2025-05-01' },
          { type: 'publication', date: '2025-05-09' },
          { type: 'revision', date: '2025-05-06' }
        ]
      })).toBe('2025-05-06')
    })

    test('falls back to the next type when the first has no date', () => {
      expect(updatedAt({
        resourceDate: [
          { type: 'revision', date: null },
          { type: 'publication', date: '2025-05-09' }
        ]
      })).toBe('2025-05-09')
    })

    test('falls back to the next type when the first is missing', () => {
      expect(updatedAt({
        resourceDate: [
          { type: 'creation', date: '2024-01-01T00:00:00Z' },
          { type: 'publication', date: '2017-09-14T00:00:00Z' }
        ]
      })).toBe('2017-09-14T00:00:00Z')
    })

    test('returns null when none of the types are present', () => {
      expect(updatedAt({
        resourceDate: [{ type: 'creation', date: '2024-01-01T00:00:00Z' }]
      })).toBeNull()
    })

    test('returns null when the field is missing', () => {
      expect(updatedAt({})).toBeNull()
    })
  })

  describe('allDefaults', () => {
    test('returns all default values from a multilingual array', () => {
      expect(allDefaults('tag')({
        tag: [
          { default: 'landscape' },
          { default: 'ecology' },
          { default: 'environment' }
        ]
      })).toEqual(['landscape', 'ecology', 'environment'])
    })

    test('filters out entries without a default', () => {
      expect(allDefaults('tag')({
        tag: [{ default: 'landscape' }, {}, { default: null }, { default: 'ecology' }]
      })).toEqual(['landscape', 'ecology'])
    })

    test('returns an empty array when the field is missing', () => {
      expect(allDefaults('tag')({})).toEqual([])
    })
  })

  describe('rawArray', () => {
    test('returns the array as-is', () => {
      expect(rawArray('format')({
        format: ['Shapefile (SHP)', 'GeoPackage (GPKG)']
      })).toEqual(['Shapefile (SHP)', 'GeoPackage (GPKG)'])
    })

    test('returns an empty array when the field is missing', () => {
      expect(rawArray('format')({})).toEqual([])
    })
  })

  describe('firstNestedCode', () => {
    test('returns the code from the first CRS entry', () => {
      expect(firstNestedCode('crsDetails')({
        crsDetails: [{ code: 'http://www.opengis.net/def/crs/EPSG/0/27700' }]
      })).toBe('http://www.opengis.net/def/crs/EPSG/0/27700')
    })

    test('returns null when the field is missing', () => {
      expect(firstNestedCode('crsDetails')({})).toBeNull()
    })
  })

  describe('datedEntry', () => {
    test('finds the date matching the requested type', () => {
      expect(datedEntry('resourceDate', 'publication')({
        resourceDate: [
          { type: 'creation', date: '2024-01-01T00:00:00Z' },
          { type: 'publication', date: '2017-09-14T00:00:00Z' },
          { type: 'revision', date: '2025-04-15T00:00:00Z' }
        ]
      })).toBe('2017-09-14T00:00:00Z')
    })

    test('returns null when no entry matches the type', () => {
      expect(datedEntry('resourceDate', 'publication')({
        resourceDate: [
          { type: 'creation', date: '2024-01-01T00:00:00Z' }
        ]
      })).toBeNull()
    })

    test('returns null when the field is missing', () => {
      expect(datedEntry('resourceDate', 'creation')({})).toBeNull()
    })
  })

  describe('resolution', () => {
    test('maps scale denominators to numbers', () => {
      expect(resolution({
        resolutionScaleDenominator: ['250000', 10000]
      })).toEqual({ scaleDenominators: [250000, 10000], distances: [] })
    })

    test('preserves distances and their units', () => {
      expect(resolution({
        resolutionDistance: ['2 m', '10 cm']
      })).toEqual({ scaleDenominators: [], distances: ['2 m', '10 cm'] })
    })

    test('maps scales and distances together', () => {
      expect(resolution({
        resolutionScaleDenominator: ['250000'],
        resolutionDistance: ['2 m']
      })).toEqual({ scaleDenominators: [250000], distances: ['2 m'] })
    })

    test('returns null when resolution is missing', () => {
      expect(resolution({})).toBeNull()
    })

    test('returns null when the resolution arrays are empty', () => {
      expect(resolution({
        resolutionScaleDenominator: [],
        resolutionDistance: []
      })).toBeNull()
    })

    test('ignores unusable values', () => {
      expect(resolution({
        resolutionScaleDenominator: [null, '', 'unknown', 0, -1, 1.5, '250000'],
        resolutionDistance: [null, '', '  ', '2 m']
      })).toEqual({ scaleDenominators: [250000], distances: ['2 m'] })
    })
  })
})
