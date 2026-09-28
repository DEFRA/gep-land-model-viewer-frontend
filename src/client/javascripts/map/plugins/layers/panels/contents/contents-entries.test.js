import { describe, expect, test } from 'vitest'
import { getContentsEntries } from './contents-entries.js'

const DATASETS = [{
  id: 'woodland',
  title: 'Ancient Woodland',
  source: {
    type: 'fgb',
    styleConfig: {
      themes: [{
        label: 'Woodland',
        band: 1,
        classes: [{ label: 'One', fill: [10, 20, 30, 1] }],
        default: { label: 'Other', fill: [40, 50, 60, 1] }
      }]
    }
  }
}, {
  id: 'flood',
  title: 'Flood Zones',
  source: { type: 'wms' }
}]

function createPluginState ({ layers } = {}, datasets = DATASETS) {
  return {
    layers: (layers ?? [
      { id: 'grid', ready: true },
      { id: 'flood', ready: false },
      { id: 'woodland', ready: true, hidden: true }
    ]).map(layer => ({ ...datasets.find(dataset => dataset.id === layer.id), ...layer }))
  }
}

describe('Contents entries', () => {
  test('combines added datasets and summaries in display order', () => {
    const entries = getContentsEntries(createPluginState())

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
      title: 'Single style',
      source: {
        type: 'fgb',
        styleConfig: { themes: [{ label: 'Single style', band: 1, classes: [], default: style }] }
      }
    }]

    expect(getContentsEntries(createPluginState({
      layers: [{ id: 'single', ready: true }]
    }, datasets))[0].swatch).toEqual({ type: 'style', definition: style })
  })

  test('shows an empty swatch while a dataset source is loading', () => {
    expect(getContentsEntries({ layers: [{ id: 'new', title: 'New dataset', ready: false }] })[0]).toMatchObject({
      label: 'New dataset',
      loading: true,
      swatch: { type: 'colours', colours: [] }
    })
  })
})
