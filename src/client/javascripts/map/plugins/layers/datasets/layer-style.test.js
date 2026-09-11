import { describe, expect, test } from 'vitest'
import { colourForDefinition, getLayerStyle } from './layer-style.js'
import { editableStyleEntries } from './style-config.js'

const fill = { label: 'Filled', fill: [10, 20, 30, 0.8], stroke: { color: [40, 50, 60, 1], width: 2 } }
const outline = { label: 'Outline', fill: [0, 0, 0, 0], stroke: { color: [40, 50, 60, 0.6], width: 3 } }
const hidden = { label: 'Hidden', fill: [10, 20, 30, 1], visible: false }
const defaults = { type: 'match', classes: [fill, hidden, outline, fill], default: { label: 'Other', fill: [0, 0, 0, 1] } }
const dataset = { source: { opacity: 0.7, styleConfig: defaults } }

describe('layer styles', () => {
  test('uses configured opacity and supports datasets without styles', () => {
    expect(getLayerStyle(dataset)).toEqual({ opacity: 0.7, styleConfig: defaults })
    expect(getLayerStyle(dataset, { id: 'test', ready: true, opacity: 0.4 })).toEqual({ opacity: 0.4, styleConfig: defaults })
    expect(getLayerStyle({ source: { type: 'wms', opacity: 0.5 } })).toEqual({ opacity: 0.5, styleConfig: undefined })
  })

  test('keys drawable entries before filtering and retains equal colours', () => {
    const entries = editableStyleEntries(defaults)
    expect(entries.map(entry => entry.key)).toEqual(['class:0', 'class:2', 'class:3', 'default'])
    expect(entries.map(entry => entry.classIndex)).toEqual([0, 2, 3, undefined])
    expect(colourForDefinition(entries[0].definition, 'fill')).toEqual([10, 20, 30, 0.8])
    expect(colourForDefinition(entries[1].definition, 'stroke')).toEqual([40, 50, 60, 0.6])
    expect(editableStyleEntries()).toEqual([])
  })

  test('merges sparse class and default overrides, preserving other style properties', () => {
    const before = structuredClone(dataset)
    const result = getLayerStyle(dataset, {
      id: 'test',
      ready: true,
      styleOverrides: {
        classes: [{ fill: [255, 0, 0, 0.8] }, undefined, { stroke: { color: [0, 255, 0, 0.6] } }],
        default: { fill: [0, 0, 255, 1] }
      }
    })

    expect(result.styleConfig.classes[0]).toEqual({ ...fill, fill: [255, 0, 0, 0.8] })
    expect(result.styleConfig.classes[2]).toEqual({ ...outline, stroke: { color: [0, 255, 0, 0.6], width: 3 } })
    expect(result.styleConfig.classes[3]).toEqual(fill)
    expect(result.styleConfig.default.fill).toEqual([0, 0, 255, 1])
    expect(dataset).toEqual(before)
  })

  test('merges fill and outline overrides independently for classes and drawable defaults', () => {
    const styled = { source: { ...dataset.source, styleConfig: { ...defaults, default: fill } } }
    const before = structuredClone(styled)
    const result = getLayerStyle(styled, {
      id: 'test',
      ready: true,
      styleOverrides: {
        classes: [{ fill: [255, 0, 0, 0.8], stroke: { color: [0, 255, 0, 1] } }],
        default: { fill: [0, 0, 255, 0.8], stroke: { color: [255, 255, 0, 1] } }
      }
    })

    expect(result.styleConfig.classes[0]).toEqual({ ...fill, fill: [255, 0, 0, 0.8], stroke: { color: [0, 255, 0, 1], width: 2 } })
    expect(result.styleConfig.default).toEqual({ ...fill, fill: [0, 0, 255, 0.8], stroke: { color: [255, 255, 0, 1], width: 2 } })
    expect(result.styleConfig.classes[3]).toEqual(fill)
    expect(styled).toEqual(before)

    const outlineOnly = getLayerStyle(dataset, {
      id: 'test', ready: true, styleOverrides: { classes: [{ stroke: { color: [0, 255, 0, 1] } }] }
    })
    expect(outlineOnly.styleConfig.classes[0].fill).toEqual(fill.fill)
    expect(outlineOnly.styleConfig.classes[0].stroke.color).toEqual([0, 255, 0, 1])
  })
})
