import { describe, expect, test } from 'vitest'
import { getAttribution } from './attribution.js'

const DATASETS = [
  { id: 'woodland', source: { attribution: 'Natural England' } },
  { id: 'peat', source: {} },
  { id: 'flood', source: { attribution: 'Environment Agency' } },
  { id: 'rivers', source: { attribution: 'Environment Agency' } }
]

function createPluginState (overrides = {}) {
  return {
    layers: [],
    ...overrides
  }
}

describe('getAttribution', () => {
  test('combines the basemap with distinct attributions for displayed datasets', () => {
    const pluginState = createPluginState({
      layers: ['flood', 'rivers', 'woodland', 'peat']
        .map(id => ({ id, ready: true }))
    })

    expect(getAttribution(DATASETS, pluginState, '© Ordnance Survey'))
      .toBe('© Ordnance Survey | Natural England | Environment Agency')
  })

  test('excludes hidden, loading and disabled datasets', () => {
    const pluginState = createPluginState({
      layers: [
        { id: 'woodland', ready: true, hidden: true },
        { id: 'rivers', ready: false }
      ]
    })

    expect(getAttribution(DATASETS, pluginState, '© Ordnance Survey')).toBe('© Ordnance Survey')
  })
})
