import { describe, expect, test } from 'vitest'
import { getAttribution } from './attribution.js'

const SOURCES = {
  woodland: { attribution: 'Natural England' },
  peat: {},
  flood: { attribution: 'Environment Agency' },
  rivers: { attribution: 'Environment Agency' }
}

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
        .map(id => ({ id, ready: true, source: SOURCES[id] }))
    })

    expect(getAttribution(pluginState, '© Ordnance Survey'))
      .toBe('© Ordnance Survey | Environment Agency | Natural England')
  })

  test('excludes hidden, loading and disabled datasets', () => {
    const pluginState = createPluginState({
      layers: [
        { id: 'woodland', ready: true, hidden: true, source: SOURCES.woodland },
        { id: 'rivers', ready: false }
      ]
    })

    expect(getAttribution(pluginState, '© Ordnance Survey')).toBe('© Ordnance Survey')
  })
})
