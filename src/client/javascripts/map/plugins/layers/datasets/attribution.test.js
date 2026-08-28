import { describe, test, expect } from 'vitest'
import { getAttribution } from './attribution.js'

const WOODLAND = { id: 'woodland', source: { attribution: 'Natural England' } }
const PEAT = { id: 'peat', source: {} }
const FLOOD = { id: 'flood', source: { attribution: 'Environment Agency' } }
const DATASETS = [WOODLAND, PEAT, FLOOD]

function stubLayer (id, visible = true) {
  return {
    get: key => key === 'id' ? id : undefined,
    getVisible: () => visible
  }
}

function createMap (layers = []) {
  return /** @type {import('ol/Map').default} */ (/** @type {unknown} */ ({
    getLayers: () => ({ getArray: () => layers })
  }))
}

describe('getAttribution', () => {
  test('combines the basemap with each visible dataset, without repeats', () => {
    const map = createMap([stubLayer('gep-flood'), stubLayer('gep-woodland')])

    expect(getAttribution(map, DATASETS, '© Ordnance Survey'))
      .toBe('© Ordnance Survey | Environment Agency | Natural England')
  })

  test('includes datasets that do not draw with WMS', () => {
    const map = createMap([stubLayer('gep-woodland')])

    expect(getAttribution(map, DATASETS, '© Ordnance Survey')).toBe('© Ordnance Survey | Natural England')
  })

  test('counts a detail layer and its overview once', () => {
    const map = createMap([stubLayer('gep-woodland'), stubLayer('gep-woodland-overview')])

    expect(getAttribution(map, DATASETS, '© Ordnance Survey')).toBe('© Ordnance Survey | Natural England')
  })

  test('omits datasets without attribution', () => {
    const map = createMap([stubLayer('gep-peat')])

    expect(getAttribution(map, DATASETS, '© Ordnance Survey')).toBe('© Ordnance Survey')
  })

  test('omits hidden datasets', () => {
    const map = createMap([stubLayer('gep-flood', false)])

    expect(getAttribution(map, DATASETS, '© Ordnance Survey')).toBe('© Ordnance Survey')
  })

  test('returns the basemap attribution when no datasets are enabled', () => {
    expect(getAttribution(createMap(), DATASETS, '© Ordnance Survey')).toBe('© Ordnance Survey')
  })
})
