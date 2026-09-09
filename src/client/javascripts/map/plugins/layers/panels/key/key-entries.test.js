import { describe, expect, test } from 'vitest'
import { getKeyEntries } from './key-entries.js'

const STYLE_CONFIG = {
  classes: [{ label: 'Bog', fill: [194, 158, 215, 1] }, {
    label: 'Outlined site',
    fill: [178, 102, 204, 1],
    stroke: { color: [112, 48, 135, 1], width: 1.25 }
  }, {
    label: 'Hidden class',
    fill: [255, 0, 0, 1],
    visible: false
  }]
}

const DATASETS = [{
  id: 'flood',
  label: 'Flood Zones',
  source: { type: 'wms', url: '/wms' }
}, {
  id: 'habitats',
  label: 'Habitats',
  source: { type: 'fgb', styleConfig: STYLE_CONFIG }
}]

function createPluginState (overrides = {}) {
  return {
    layers: [
      { id: 'habitats', ready: true },
      { id: 'flood', ready: true, wmsLayerNames: ['zone_2', 'zone_3'] }
    ],
    ...overrides
  }
}

describe('getKeyEntries', () => {
  test('follows Contents order across WMS and styled datasets', () => {
    expect(getKeyEntries(DATASETS, createPluginState())).toEqual([{
      type: 'style',
      id: 'habitats',
      label: 'Habitats',
      styles: [STYLE_CONFIG.classes[0], STYLE_CONFIG.classes[1]]
    }, {
      type: 'wms',
      id: 'flood',
      label: 'Flood Zones',
      baseUrl: '/wms',
      layerNames: ['zone_2', 'zone_3']
    }])
  })

  test('excludes hidden and loading layers', () => {
    expect(getKeyEntries(DATASETS, createPluginState({
      layers: [
        { id: 'flood', ready: false },
        { id: 'habitats', ready: true, hidden: true }
      ]
    }))).toEqual([])
  })

  test('omits a WMS entry whose loading result has no layer names', () => {
    expect(getKeyEntries(DATASETS, createPluginState({
      layers: [{ id: 'flood', ready: true }]
    }))).toEqual([])
  })
})
