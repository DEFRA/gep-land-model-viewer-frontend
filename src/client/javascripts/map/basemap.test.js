import { vi, describe, test, expect } from 'vitest'
import { getBasemapLayer } from './basemap.js'

describe('#getBasemapLayer', () => {
  test('returns the layer at index 0', () => {
    const basemapLayer = { getSource: vi.fn() }
    const map = /** @type {any} */ ({
      getLayers: vi.fn(() => ({
        item: vi.fn((index) => index === 0 ? basemapLayer : null)
      }))
    })

    expect(getBasemapLayer(map)).toBe(basemapLayer)
  })
})
