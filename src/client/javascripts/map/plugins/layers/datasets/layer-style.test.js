import { describe, expect, test } from 'vitest'
import { colourForDefinition, getLayerStyle } from './layer-style.js'
import { editableStyleEntries } from './style-config.js'
import { actions, initialState } from '../reducer.js'
import { THEMED_DATASET } from './test-helpers/themed-dataset.js'
import { getKeyEntries } from '../panels/key/key-entries.js'
import { getContentsEntries } from '../panels/contents/contents-entries.js'

const fill = { label: 'Filled', fill: [10, 20, 30, 0.8], stroke: { color: [40, 50, 60, 1], width: 2 } }
const outline = { label: 'Outline', fill: [0, 0, 0, 0], stroke: { color: [40, 50, 60, 0.6], width: 3 } }
const hidden = { label: 'Hidden', fill: [10, 20, 30, 1], visible: false }
const defaults = { label: 'Land cover', type: 'match', band: 1, classes: [fill, hidden, outline, fill], default: { label: 'Other', fill: [0, 0, 0, 1] } }
const dataset = { source: { opacity: 0.7, styleConfig: { themes: [defaults] } } }

describe('layer styles', () => {
  test('keeps each theme’s edits through switching and resets only the displayed theme', () => {
    const dataset = THEMED_DATASET
    const before = structuredClone(dataset)
    const [crop, county] = dataset.source.styleConfig.themes
    let state = { ...initialState, layers: [{ id: dataset.id, ready: true }] }
    const dispatch = (type, payload) => { state = actions[type](state, { id: dataset.id, ...payload }) }
    const expectPresentation = (theme, fill) => {
      const resolved = getLayerStyle(dataset, state.layers[0])
      expect(resolved.theme).toBe(theme)
      expect(resolved.styleConfig.classes[0].fill).toEqual(fill)
      expect(getKeyEntries([dataset], state)[0].styles[0].fill).toEqual(fill)
      expect(getContentsEntries([dataset], state)[0].swatch.definition.fill).toEqual(fill)
    }

    expectPresentation(crop, crop.classes[0].fill)
    dispatch('SET_LAYER_COLOUR', { themeBand: 1, classIndex: 0, part: 'fill', colour: [255, 0, 0, 1] })
    dispatch('SET_LAYER_OPACITY', { opacity: 0.4 })
    expectPresentation(crop, [255, 0, 0, 1])

    dispatch('SET_LAYER_THEME', { themeBand: 2 })
    expectPresentation(county, county.classes[0].fill)
    dispatch('SET_LAYER_COLOUR', { themeBand: 2, classIndex: 0, part: 'fill', colour: [0, 128, 0, 1] })
    expectPresentation(county, [0, 128, 0, 1])

    dispatch('SET_LAYER_THEME', { themeBand: 1 })
    expectPresentation(crop, [255, 0, 0, 1])
    expect(getLayerStyle(dataset, state.layers[0]).opacity).toBe(0.4)
    dispatch('RESET_LAYER_STYLE', { themeBand: 1 })
    expectPresentation(crop, crop.classes[0].fill)
    expect(getLayerStyle(dataset, state.layers[0]).opacity).toBe(dataset.source.opacity)

    dispatch('SET_LAYER_THEME', { themeBand: 2 })
    expectPresentation(county, [0, 128, 0, 1])
    expect(dataset).toEqual(before)
  })

  test('uses configured opacity and supports datasets without styles', () => {
    expect(getLayerStyle(dataset)).toEqual({ theme: defaults, overrides: undefined, opacity: 0.7, styleConfig: defaults })
    expect(getLayerStyle(dataset, { id: 'test', ready: true, opacity: 0.4 })).toEqual({ theme: defaults, overrides: undefined, opacity: 0.4, styleConfig: defaults })
    expect(getLayerStyle({ source: { type: 'wms', opacity: 0.5 } })).toEqual({ theme: undefined, overrides: undefined, opacity: 0.5, styleConfig: undefined })
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
    const before = structuredClone(defaults)
    const result = getLayerStyle(dataset, {
      id: 'test',
      ready: true,
      styleOverridesByTheme: {
        1: {
          classes: [{ fill: [255, 0, 0, 0.8] }, undefined, { stroke: { color: [0, 255, 0, 0.6] } }],
          default: { fill: [0, 0, 255, 1] }
        }
      }
    })

    expect(result.styleConfig.classes[0]).toEqual({ ...fill, fill: [255, 0, 0, 0.8] })
    expect(result.styleConfig.classes[2]).toEqual({ ...outline, stroke: { color: [0, 255, 0, 0.6], width: 3 } })
    expect(result.styleConfig.classes[3]).toEqual(fill)
    expect(result.styleConfig.default.fill).toEqual([0, 0, 255, 1])
    expect(defaults).toEqual(before)
  })

  test('merges fill and outline overrides independently for classes and drawable defaults', () => {
    const styled = { ...defaults, default: fill }
    const before = structuredClone(styled)
    const result = getLayerStyle({ source: { ...dataset.source, styleConfig: { themes: [styled] } } }, {
      id: 'test',
      ready: true,
      styleOverridesByTheme: {
        1: {
          classes: [{ fill: [255, 0, 0, 0.8], stroke: { color: [0, 255, 0, 1] } }],
          default: { fill: [0, 0, 255, 0.8], stroke: { color: [255, 255, 0, 1] } }
        }
      }
    })

    expect(result.styleConfig.classes[0]).toEqual({ ...fill, fill: [255, 0, 0, 0.8], stroke: { color: [0, 255, 0, 1], width: 2 } })
    expect(result.styleConfig.default).toEqual({ ...fill, fill: [0, 0, 255, 0.8], stroke: { color: [255, 255, 0, 1], width: 2 } })
    expect(result.styleConfig.classes[3]).toEqual(fill)
    expect(styled).toEqual(before)

    const outlineOnly = getLayerStyle(dataset, {
      id: 'test', ready: true, styleOverridesByTheme: { 1: { classes: [{ stroke: { color: [0, 255, 0, 1] } }] } }
    })
    expect(outlineOnly.styleConfig.classes[0].fill).toEqual(fill.fill)
    expect(outlineOnly.styleConfig.classes[0].stroke.color).toEqual([0, 255, 0, 1])
  })
})
