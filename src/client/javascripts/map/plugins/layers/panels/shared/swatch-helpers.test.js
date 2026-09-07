import { describe, expect, test } from 'vitest'
import { swatchColours } from './swatch-helpers.js'

const STYLE_CONFIG = {
  classes: [{
    label: 'Fill and stroke',
    fill: [10, 20, 30, 0.5],
    stroke: { color: [40, 50, 60, 1], width: 2 }
  }, {
    label: 'Duplicate fill',
    fill: [10, 20, 30, 0.5]
  }, {
    label: 'Hidden',
    visible: false,
    fill: [70, 80, 90, 1]
  }],
  default: {
    label: 'Stroke only',
    fill: [0, 0, 0, 0],
    stroke: { color: [90, 100, 110, 0.75], width: 1 }
  }
}

describe('swatch helpers', () => {
  test('returns distinct representative colours for visible styles', () => {
    expect(swatchColours(STYLE_CONFIG)).toEqual([
      [10, 20, 30, 0.5],
      [90, 100, 110, 0.75]
    ])
  })
})
