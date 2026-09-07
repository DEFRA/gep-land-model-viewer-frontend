import { describe, expect, test } from 'vitest'
import { getContentsEntries } from './contents-entries.js'

const DATASETS = [{
  id: 'woodland',
  label: 'Ancient Woodland',
  source: {
    type: 'fgb',
    styleConfig: {
      classes: [{ label: 'One', fill: [10, 20, 30, 1] }],
      default: { label: 'Other', fill: [40, 50, 60, 1] }
    }
  }
}, {
  id: 'flood',
  label: 'Flood Zones',
  source: { type: 'wms' }
}]

function createPluginState (overrides = {}) {
  return {
    layers: [
      { id: 'grid', ready: true },
      { id: 'flood', ready: false },
      { id: 'woodland', ready: true, hidden: true }
    ],
    ...overrides
  }
}

describe('Contents entries', () => {
  test('combines added datasets and summaries in display order', () => {
    const entries = getContentsEntries(DATASETS, createPluginState())

    expect(entries.map(({ id, kind, hidden, loading }) => ({ id, kind, hidden, loading }))).toEqual([
      { id: 'grid', kind: 'summary', hidden: false, loading: false },
      { id: 'flood', kind: 'dataset', hidden: false, loading: true },
      { id: 'woodland', kind: 'dataset', hidden: true, loading: false }
    ])
    expect(entries[0]).toMatchObject({ label: 'Grid squares', swatch: { type: 'line' } })
    expect(entries[1]).toMatchObject({ label: 'Flood Zones', swatch: { type: 'wms' } })
    expect(entries[2]).toMatchObject({
      swatch: {
        type: 'colours',
        colours: [[10, 20, 30, 1], [40, 50, 60, 1]]
      }
    })
  })

  test('keeps fill and stroke together for a single-style dataset', () => {
    const style = {
      fill: [10, 20, 30, 1],
      stroke: { color: [40, 50, 60, 1], width: 1 }
    }
    const datasets = [{
      id: 'single',
      label: 'Single style',
      source: {
        type: 'fgb',
        styleConfig: { classes: [], default: style }
      }
    }]

    expect(getContentsEntries(datasets, createPluginState({
      layers: [{ id: 'single', ready: true }]
    }))[0].swatch).toEqual({ type: 'style', definition: style })
  })

  test('ignores layer ids that have no configured dataset or summary', () => {
    expect(getContentsEntries(DATASETS, createPluginState({
      layers: [{ id: 'unknown', ready: true }]
    }))).toEqual([])
  })
})
