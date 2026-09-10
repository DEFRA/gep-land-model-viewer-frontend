import { describe, test, expect } from 'vitest'
import { parseLiteralStyle } from 'ol/render/webgl/style.js'
import sssiStyle from '../../../../../data/styles/sssi.json'
import {
  classForCogValue,
  buildCogColourExpression,
  visibleClassForBands,
  visibleClassForFieldValue,
  buildVectorStyle,
  buildVectorStyleWithVariables
} from './style-config.js'

const TRANSPARENT = [0, 0, 0, 0]
const BOG = [194, 158, 215, 1]
const WATER = [190, 232, 255, 1]
const OUTSIDE_RANGE = [0, 0, 224, 1]

function matchStyle (overrides = {}) {
  return {
    type: 'match',
    field: 'category',
    classes: [
      { bandValue: 1, fieldValues: ['Bog'], label: 'Bog', fill: BOG },
      { bandValue: 2, fieldValues: ['Standing Water', 'Canal'], label: 'Water', fill: WATER }
    ],
    default: { label: 'Other', fill: TRANSPARENT },
    ...overrides
  }
}

function sourceValueRangeStyle (overrides = {}) {
  return {
    type: 'range',
    field: 'depth',
    minValue: 0,
    classes: [
      { maxValue: 20, label: 'Up to 20cm', fill: [204, 204, 255, 1] },
      { maxValue: 500, label: '20 to 500cm', fill: [20, 20, 227, 1] }
    ],
    default: { label: 'Outside configured range', fill: OUTSIDE_RANGE },
    ...overrides
  }
}

function classCodedRangeStyle () {
  return sourceValueRangeStyle({
    classes: [
      { bandValue: 1, maxValue: 20, label: 'Up to 20cm', fill: [204, 204, 255, 1] },
      { bandValue: 2, maxValue: 500, label: '20 to 500cm', fill: [20, 20, 227, 1] }
    ],
    default: { bandValue: 3, label: 'Outside configured range', fill: OUTSIDE_RANGE }
  })
}

function uniformStyle (classOverrides = {}) {
  return {
    type: 'uniform',
    classes: [{
      bandValue: 1,
      label: 'Site',
      fill: [178, 102, 204, 1],
      ...classOverrides
    }]
  }
}

describe('class-coded COG rules', () => {
  test('a match COG compares its pixel with each class bandValue', () => {
    expect(buildCogColourExpression(matchStyle())).toEqual([
      'case',
      ['==', ['band', 1], 1], BOG,
      ['==', ['band', 1], 2], WATER,
      TRANSPARENT
    ])
  })

  test('a class-coded range COG ignores its numeric bounds and compares bandValue', () => {
    expect(buildCogColourExpression(classCodedRangeStyle())).toEqual([
      'case',
      ['==', ['band', 1], 1], [204, 204, 255, 1],
      ['==', ['band', 1], 2], [20, 20, 227, 1],
      ['==', ['band', 1], 3], OUTSIDE_RANGE,
      TRANSPARENT
    ])
  })

  test('visible false makes a COG class transparent', () => {
    expect(buildCogColourExpression(uniformStyle({ visible: false }))).toEqual([
      'case',
      ['==', ['band', 1], 1], TRANSPARENT,
      TRANSPARENT
    ])
  })
})

describe('source-value range COG rules', () => {
  test('pixels are compared with minValue and each inclusive maxValue', () => {
    expect(buildCogColourExpression(sourceValueRangeStyle())).toEqual([
      'case',
      ['<', ['band', 1], 0], OUTSIDE_RANGE,
      ['<=', ['band', 1], 20], [204, 204, 255, 1],
      ['<=', ['band', 1], 500], [20, 20, 227, 1],
      OUTSIDE_RANGE
    ])
  })

  test.each([
    { name: 'the first maxValue is inclusive', value: 20, expectedLabel: 'Up to 20cm' },
    { name: 'the next value selects the next range', value: 21, expectedLabel: '20 to 500cm' },
    { name: 'a value below minValue selects the default', value: -1, expectedLabel: 'Outside configured range' },
    { name: 'a value above the final maxValue selects the default', value: 501, expectedLabel: 'Outside configured range' }
  ])('$name', ({ value, expectedLabel }) => {
    expect(classForCogValue(sourceValueRangeStyle(), value)?.label).toBe(expectedLabel)
  })
})

describe('vector style rules', () => {
  test('a match style expands grouped fieldValues and ignores COG bandValue', () => {
    expect(buildVectorStyle(matchStyle())).toEqual({
      'fill-color': [
        'match', ['get', 'category'],
        'Bog', BOG,
        'Standing Water', WATER,
        'Canal', WATER,
        TRANSPARENT
      ]
    })
  })

  test('a range style compares the source field even when its COG is class-coded', () => {
    expect(buildVectorStyle(classCodedRangeStyle())).toEqual({
      'fill-color': [
        'case',
        ['<', ['get', 'depth'], 0], OUTSIDE_RANGE,
        ['<=', ['get', 'depth'], 20], [204, 204, 255, 1],
        ['<=', ['get', 'depth'], 500], [20, 20, 227, 1],
        OUTSIDE_RANGE
      ]
    })
  })

  test('a fieldless raster range cannot style vector features', () => {
    expect(() => buildVectorStyle(sourceValueRangeStyle({ field: undefined }))).toThrow('needs a field')
  })

  test('a uniform style applies its fill and stroke directly', () => {
    expect(buildVectorStyle(uniformStyle({
      stroke: { color: [112, 48, 135, 1], width: 1.25 }
    }))).toEqual({
      'fill-color': [178, 102, 204, 1],
      'stroke-color': [112, 48, 135, 1],
      'stroke-width': 1.25
    })
  })

  test('match classes and the default can each define their own stroke', () => {
    const styleConfig = matchStyle({
      classes: [
        {
          bandValue: 1,
          fieldValues: ['Bog'],
          label: 'Bog',
          fill: BOG,
          stroke: { color: [0, 0, 0, 1], width: 1 }
        },
        {
          bandValue: 2,
          fieldValues: ['Water'],
          label: 'Water',
          fill: WATER,
          stroke: { color: [255, 0, 0, 1], width: 3 }
        }
      ],
      default: {
        label: 'Other',
        fill: [1, 2, 3, 1],
        stroke: { color: [4, 5, 6, 1], width: 2 }
      }
    })

    const style = buildVectorStyle(styleConfig)

    expect(style['stroke-color']).toEqual([
      'match', ['get', 'category'],
      'Bog', [0, 0, 0, 1],
      'Water', [255, 0, 0, 1],
      [4, 5, 6, 1]
    ])
    expect(style['stroke-width']).toEqual([
      'match', ['get', 'category'],
      'Bog', 1,
      'Water', 3,
      2
    ])
  })

  test('visible false hides both the fill and stroke of a matched class', () => {
    const styleConfig = matchStyle({
      classes: [
        {
          bandValue: 1,
          fieldValues: ['Bog'],
          label: 'Bog',
          fill: BOG,
          stroke: { color: [0, 0, 0, 1], width: 1 }
        },
        {
          bandValue: 2,
          fieldValues: ['Water'],
          label: 'Water',
          fill: WATER,
          stroke: { color: [255, 0, 0, 1], width: 3 },
          visible: false
        }
      ]
    })

    const style = buildVectorStyle(styleConfig)

    expect(style['fill-color']).toEqual([
      'match', ['get', 'category'],
      'Bog', BOG,
      'Water', TRANSPARENT,
      TRANSPARENT
    ])
    expect(style['stroke-color']).toEqual([
      'match', ['get', 'category'],
      'Bog', [0, 0, 0, 1],
      'Water', TRANSPARENT,
      TRANSPARENT
    ])
    expect(style['stroke-width']).toEqual([
      'match', ['get', 'category'],
      'Bog', 1,
      'Water', 0,
      0
    ])
  })
})

describe('WebGL vector colour variables', () => {
  const filled = { fieldValues: ['Land'], fill: [10, 20, 30, 0.8], stroke: { color: [40, 50, 60, 0.6], width: 2 } }
  const outline = { fieldValues: ['Edge'], fill: [0, 0, 0, 0], stroke: { color: [40, 50, 60, 0.6], width: 3 } }
  const defaults = {
    type: 'match',
    field: 'category',
    classes: [
      filled,
      { ...filled, fieldValues: ['Hidden'], visible: false },
      outline,
      { ...filled, fieldValues: ['Same colour'] }
    ],
    default: { fill: [100, 110, 120, 0.5] }
  }

  test('keeps separate variables for original class indices and drawable defaults', () => {
    const before = structuredClone(defaults)
    const { style, variables } = buildVectorStyleWithVariables(defaults)

    expect(variables).toEqual({
      class_0_fill: 'rgba(10, 20, 30, 0.8)',
      class_0_stroke: 'rgba(40, 50, 60, 0.6)',
      class_2_stroke: 'rgba(40, 50, 60, 0.6)',
      class_3_fill: 'rgba(10, 20, 30, 0.8)',
      class_3_stroke: 'rgba(40, 50, 60, 0.6)',
      default_fill: 'rgba(100, 110, 120, 0.5)'
    })
    expect(style['fill-color']).toEqual([
      'match', ['get', 'category'],
      'Land', ['var', 'class_0_fill'],
      'Hidden', [0, 0, 0, 0],
      'Edge', [0, 0, 0, 0],
      'Same colour', ['var', 'class_3_fill'],
      ['var', 'default_fill']
    ])
    expect(defaults).toEqual(before)
  })

  test('generates a style accepted by the OpenLayers WebGL compiler', () => {
    const { style, variables } = buildVectorStyleWithVariables(defaults)
    expect(() => parseLiteralStyle(style, variables)).not.toThrow()
  })

  test('SSSI keeps its outline width while both colours become updateable', () => {
    const { style, variables } = buildVectorStyleWithVariables(sssiStyle)
    expect(style).toEqual({
      'fill-color': ['var', 'class_0_fill'],
      'stroke-color': ['var', 'class_0_stroke'],
      'stroke-width': 1.25
    })
    expect(variables).toEqual({ class_0_fill: 'rgba(178, 102, 204, 1)', class_0_stroke: 'rgba(112, 48, 135, 1)' })
  })
})

describe('hit classification rules', () => {
  test('every grouped fieldValue identifies the same match class', () => {
    expect(visibleClassForFieldValue(matchStyle(), 'Standing Water')?.label).toBe('Water')
    expect(visibleClassForFieldValue(matchStyle(), 'Canal')?.label).toBe('Water')
  })

  test('range field values use the same inclusive bounds as source-value COG pixels', () => {
    expect(visibleClassForFieldValue(sourceValueRangeStyle(), 20)?.label).toBe('Up to 20cm')
    expect(visibleClassForFieldValue(sourceValueRangeStyle(), 21)?.label).toBe('20 to 500cm')
  })

  test('visible false prevents a vector class from being identified', () => {
    const styleConfig = matchStyle({
      classes: [{ bandValue: 1, fieldValues: ['Bog'], label: 'Bog', fill: BOG, visible: false }]
    })

    expect(visibleClassForFieldValue(styleConfig, 'Bog')).toBeNull()
  })

  test('a fully transparent default is not identified', () => {
    expect(visibleClassForFieldValue(matchStyle(), 'Unknown')).toBeNull()
  })

  test('a transparent vector fill remains identifiable when its stroke is visible', () => {
    const styleConfig = uniformStyle({
      fill: TRANSPARENT,
      stroke: { color: [1, 2, 3, 1], width: 1 }
    })

    expect(visibleClassForFieldValue(styleConfig, undefined)?.label).toBe('Site')
  })

  test('a COG reads its value from the first band when its mask is visible', () => {
    expect(visibleClassForBands(matchStyle(), new Float32Array([2, 255]))?.label).toBe('Water')
  })

  test.each([
    { name: 'missing pixel data cannot be identified', bands: null },
    { name: 'a zero mask cannot be identified', bands: new Float32Array([2, 0]) }
  ])('$name', ({ bands }) => {
    expect(visibleClassForBands(matchStyle(), bands)).toBeNull()
  })

  test('class-coded COG values, including the default, must match a bandValue exactly', () => {
    const styleConfig = matchStyle({
      default: { bandValue: 3, label: 'Other', fill: OUTSIDE_RANGE }
    })

    expect(classForCogValue(styleConfig, 2)?.label).toBe('Water')
    expect(classForCogValue(styleConfig, 3)?.label).toBe('Other')
    expect(classForCogValue(styleConfig, 1.9999998)).toBeNull()
    expect(classForCogValue(styleConfig, 99)).toBeNull()
  })

  test('a COG class with no visible fill cannot be identified', () => {
    const hidden = uniformStyle({ visible: false })
    const transparentWithStroke = uniformStyle({
      fill: TRANSPARENT,
      stroke: { color: [1, 2, 3, 1], width: 1 }
    })

    expect(visibleClassForBands(hidden, new Float32Array([1]))).toBeNull()
    expect(visibleClassForBands(transparentWithStroke, new Float32Array([1]))).toBeNull()
  })
})
