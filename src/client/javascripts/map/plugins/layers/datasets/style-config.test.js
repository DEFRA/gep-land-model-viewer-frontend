import { describe, test, expect } from 'vitest'
import { validateStyleConfig, cogColorFor, vectorStyleFor, classForBandValue, classForBands } from './style-config.js'

const TRANSPARENT = [0, 0, 0, 0]

function styleConfigFixture (overrides = {}) {
  return {
    name: 'Test habitats',
    field: 'category',
    classes: [
      { bandValue: 1, fieldValue: 'Bog', label: 'Bog', fill: [194, 158, 215, 1] },
      { bandValue: 2, fieldValue: 'Standing Water', label: 'Water', fill: [190, 232, 255, 1] }
    ],
    default: { fill: TRANSPARENT },
    ...overrides
  }
}

function rangeConfigFixture (overrides = {}) {
  return {
    name: 'Test depths',
    classes: [
      { maxBandValue: 20, label: 'Up to 20cm', fill: [204, 204, 255, 1] },
      { maxBandValue: 500, label: '20 to 500cm', fill: [20, 20, 227, 1] },
      { label: 'Over 500cm', fill: [0, 0, 224, 1] }
    ],
    ...overrides
  }
}

describe('#validateStyleConfig', () => {
  test('accepts a categorical config', () => {
    expect(() => validateStyleConfig(styleConfigFixture(), 'test')).not.toThrow()
  })

  test('requires every bandValue when used by a categorical COG overview', () => {
    const config = styleConfigFixture({
      classes: [
        { bandValue: 1, fieldValue: 'Bog', label: 'Bog', fill: TRANSPARENT },
        { fieldValue: 'Water', label: 'Water', fill: TRANSPARENT }
      ]
    })

    expect(() => validateStyleConfig(config, 'test')).not.toThrow()
    expect(() => validateStyleConfig(config, 'test', { requireBandValues: true }))
      .toThrow('Dataset test has a cog overview but not every style class carries a bandValue')
  })

  test('accepts a range config with an open-ended last class', () => {
    expect(() => validateStyleConfig(rangeConfigFixture(), 'test')).not.toThrow()
  })

  test('accepts a single unkeyed class with no field', () => {
    const config = {
      stroke: { color: [112, 48, 135, 1], width: 1.25 },
      classes: [{ label: 'Site', fill: [178, 102, 204, 1] }]
    }

    expect(() => validateStyleConfig(config, 'test')).not.toThrow()
  })

  test('rejects a config without classes', () => {
    expect(() => validateStyleConfig(styleConfigFixture({ classes: [] }), 'test')).toThrow('Dataset test style config must define classes')
    expect(() => validateStyleConfig(undefined, 'test')).toThrow('Dataset test style config must define classes')
  })

  test('rejects a class missing a label or fill', () => {
    const noLabel = styleConfigFixture({ classes: [{ bandValue: 1, fill: TRANSPARENT }] })
    const shortFill = styleConfigFixture({ classes: [{ bandValue: 1, label: 'Bog', fill: [1, 2, 3] }] })

    expect(() => validateStyleConfig(noLabel, 'test')).toThrow('label and an [r, g, b, a] fill')
    expect(() => validateStyleConfig(shortFill, 'test')).toThrow('label and an [r, g, b, a] fill')
  })

  test('rejects a class mixing categorical and range values', () => {
    const config = styleConfigFixture({
      classes: [{ bandValue: 1, maxBandValue: 20, label: 'Bog', fill: TRANSPARENT }]
    })

    expect(() => validateStyleConfig(config, 'test')).toThrow('mixes categorical and range values')
  })

  test('rejects mixed keyed and unkeyed categorical classes', () => {
    const config = styleConfigFixture({
      classes: [
        { bandValue: 1, label: 'Bog', fill: TRANSPARENT },
        { label: 'Water', fill: TRANSPARENT }
      ]
    })

    expect(() => validateStyleConfig(config, 'test')).toThrow('mixes keyed and unkeyed classes')
  })

  test('rejects a categorical key owned by different classes', () => {
    const config = styleConfigFixture({
      classes: [
        { bandValue: 1, fieldValue: '2', label: 'Bog', fill: TRANSPARENT },
        { bandValue: 2, fieldValue: 'Water', label: 'Water', fill: TRANSPARENT }
      ]
    })

    expect(() => validateStyleConfig(config, 'test')).toThrow('repeats categorical key "2" across classes')
  })

  test('rejects multiple unkeyed classes', () => {
    const config = {
      classes: [
        { label: 'One', fill: TRANSPARENT },
        { label: 'Two', fill: TRANSPARENT }
      ]
    }

    expect(() => validateStyleConfig(config, 'test')).toThrow('no bandValue, fieldValue or maxBandValue keys')
  })

  test('rejects a range class before the last without a maxBandValue', () => {
    const config = rangeConfigFixture({
      classes: [
        { maxBandValue: 20, label: 'Up to 20cm', fill: TRANSPARENT },
        { label: 'Odd one', fill: TRANSPARENT },
        { maxBandValue: 500, label: '20 to 500cm', fill: TRANSPARENT }
      ]
    })

    expect(() => validateStyleConfig(config, 'test')).toThrow('except an open-ended last class')
  })

  test('rejects range breaks that do not ascend', () => {
    const config = rangeConfigFixture({
      classes: [
        { maxBandValue: 500, label: 'Up to 500cm', fill: TRANSPARENT },
        { maxBandValue: 20, label: 'Odd', fill: TRANSPARENT }
      ]
    })

    expect(() => validateStyleConfig(config, 'test')).toThrow('range breaks must ascend')
  })

  test('rejects a bandValue on an open-ended range class', () => {
    const config = rangeConfigFixture({
      classes: [
        { maxBandValue: 20, label: 'Up to 20cm', fill: TRANSPARENT },
        { bandValue: 2, label: 'Over 20cm', fill: TRANSPARENT }
      ]
    })

    expect(() => validateStyleConfig(config, 'test')).toThrow('range classes cannot have bandValues or fieldValues')
  })

  test('rejects non-numeric class values', () => {
    const badBandValue = styleConfigFixture({
      classes: [{ bandValue: '1', fieldValue: 'Bog', label: 'Bog', fill: TRANSPARENT }]
    })
    const badBreak = rangeConfigFixture({
      classes: [{ maxBandValue: '20', label: 'Up to 20cm', fill: TRANSPARENT }]
    })

    expect(() => validateStyleConfig(badBandValue, 'test')).toThrow('bandValues must be numbers')
    expect(() => validateStyleConfig(badBreak, 'test')).toThrow('maxBandValues must be numbers')
  })

  test('rejects fieldValues without a field name', () => {
    const config = styleConfigFixture({ field: undefined })

    expect(() => validateStyleConfig(config, 'test')).toThrow('fieldValues but no field is named')
  })

  test('rejects malformed stroke and default shapes', () => {
    expect(() => validateStyleConfig(styleConfigFixture({ stroke: { color: [1, 2, 3, 1] } }), 'test')).toThrow('stroke must have')
    expect(() => validateStyleConfig(styleConfigFixture({ default: {} }), 'test')).toThrow('default must have')
  })
})

describe('#cogColorFor', () => {
  test('builds a band value lookup ending in the default fill', () => {
    expect(cogColorFor(styleConfigFixture())).toEqual([
      'case',
      ['==', ['band', 1], 1], [194, 158, 215, 1],
      ['==', ['band', 1], 2], [190, 232, 255, 1],
      TRANSPARENT
    ])
  })

  test('defaults a missing default fill to transparent', () => {
    const config = styleConfigFixture({ default: undefined })

    expect(cogColorFor(config)).toEqual([
      'case',
      ['==', ['band', 1], 1], [194, 158, 215, 1],
      ['==', ['band', 1], 2], [190, 232, 255, 1],
      TRANSPARENT
    ])
  })

  test('builds an ascending break chain for range classes', () => {
    expect(cogColorFor(rangeConfigFixture())).toEqual([
      'case',
      ['<=', ['band', 1], 20], [204, 204, 255, 1],
      ['<=', ['band', 1], 500], [20, 20, 227, 1],
      [0, 0, 224, 1]
    ])
  })

  test('a bounded last range class falls back to the default fill', () => {
    const config = rangeConfigFixture({
      classes: [
        { maxBandValue: 20, label: 'Up to 20cm', fill: [204, 204, 255, 1] },
        { maxBandValue: 500, label: '20 to 500cm', fill: [20, 20, 227, 1] }
      ],
      default: { fill: [1, 1, 1, 1] }
    })

    expect(cogColorFor(config)).toEqual([
      'case',
      ['<=', ['band', 1], 20], [204, 204, 255, 1],
      ['<=', ['band', 1], 500], [20, 20, 227, 1],
      [1, 1, 1, 1]
    ])
  })
})

describe('#vectorStyleFor', () => {
  test('registers both the fieldValue and the band value as string keys', () => {
    expect(vectorStyleFor(styleConfigFixture())).toEqual({
      'fill-color': [
        'match', ['get', 'category'],
        'Bog', [194, 158, 215, 1],
        '1', [194, 158, 215, 1],
        'Standing Water', [190, 232, 255, 1],
        '2', [190, 232, 255, 1],
        TRANSPARENT
      ]
    })
  })

  test('dedupes a fieldValue that matches its own class bandValue', () => {
    const config = styleConfigFixture({
      classes: [
        { bandValue: 1, fieldValue: '1', label: 'Bog', fill: [194, 158, 215, 1] },
        { bandValue: 2, fieldValue: 'Water', label: 'Water', fill: [190, 232, 255, 1] }
      ]
    })

    expect(vectorStyleFor(config)).toEqual({
      'fill-color': [
        'match', ['get', 'category'],
        '1', [194, 158, 215, 1],
        'Water', [190, 232, 255, 1],
        '2', [190, 232, 255, 1],
        TRANSPARENT
      ]
    })
  })

  test('classes without fieldValues register their band values only', () => {
    const config = styleConfigFixture({
      classes: [{ bandValue: 1, label: 'Bog', fill: [194, 158, 215, 1] }]
    })

    expect(vectorStyleFor(config)).toEqual({
      'fill-color': [
        'match', ['get', 'category'],
        '1', [194, 158, 215, 1],
        TRANSPARENT
      ]
    })
  })

  test('a single unkeyed class with no field fills everything and carries the stroke', () => {
    const config = {
      stroke: { color: [112, 48, 135, 1], width: 1.25 },
      classes: [{ label: 'Site', fill: [178, 102, 204, 1] }]
    }

    expect(vectorStyleFor(config)).toEqual({
      'stroke-color': [112, 48, 135, 1],
      'stroke-width': 1.25,
      'fill-color': [178, 102, 204, 1]
    })
  })
})

describe('#classForBandValue', () => {
  test('returns the class definition for a categorical band value', () => {
    expect(classForBandValue(styleConfigFixture(), 2)).toEqual(
      { bandValue: 2, fieldValue: 'Standing Water', label: 'Water', fill: [190, 232, 255, 1] }
    )
  })

  test('returns null for a categorical value with no class', () => {
    expect(classForBandValue(styleConfigFixture(), 99)).toBeNull()
  })

  test('matches range breaks inclusively and falls to the open-ended last class', () => {
    const config = rangeConfigFixture()

    expect(classForBandValue(config, 20).label).toBe('Up to 20cm')
    expect(classForBandValue(config, 21).label).toBe('20 to 500cm')
    expect(classForBandValue(config, 501).label).toBe('Over 500cm')
  })

  test('returns null past a bounded last range class', () => {
    const config = rangeConfigFixture({
      classes: [{ maxBandValue: 20, label: 'Up to 20cm', fill: TRANSPARENT }]
    })

    expect(classForBandValue(config, 21)).toBeNull()
  })
})

describe('#classForBands', () => {
  test('uses the data value before the OpenLayers alpha', () => {
    const config = styleConfigFixture()

    expect(classForBands(config, new Float32Array([2, 255]))).toEqual(
      { bandValue: 2, fieldValue: 'Standing Water', label: 'Water', fill: [190, 232, 255, 1] }
    )
  })

  test('returns null when the pixel is missing or masked', () => {
    const config = styleConfigFixture()

    expect(classForBands(config, null)).toBeNull()
    expect(classForBands(config, new Float32Array([1, 0]))).toBeNull()
    expect(classForBands(config, new Float32Array([1]))?.label).toBe('Bog')
  })
})
