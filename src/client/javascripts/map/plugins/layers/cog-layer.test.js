import { vi, describe, test, expect } from 'vitest'

vi.mock('ol/source/GeoTIFF.js', () => ({
  default: vi.fn().mockImplementation(function (opts) {
    this._opts = opts
  })
}))

vi.mock('ol/layer/WebGLTile.js', () => ({
  default: vi.fn().mockImplementation(function (opts) {
    this._opts = opts
  })
}))

const { default: GeoTIFF } = await import('ol/source/GeoTIFF.js')
const { default: WebGLTileLayer } = await import('ol/layer/WebGLTile.js')
const { createCogLayer } = await import('./cog-layer.js')

describe('#createCogLayer', () => {
  test('creates a WebGL tile layer with the dataset source options', async () => {
    const dataset = {
      id: 'test-cog',
      source: {
        type: 'cog',
        url: '/land-model/raster/test.tif',
        opacity: 0.8,
        normalize: false,
        interpolate: false,
        style: { color: ['band', 1] }
      }
    }

    await createCogLayer(dataset, 'gep-test-cog')

    expect(GeoTIFF).toHaveBeenCalledWith({
      sources: [{ url: '/land-model/raster/test.tif' }],
      normalize: false,
      interpolate: false
    })

    const [layerOptions] = WebGLTileLayer.mock.calls[0]
    expect(layerOptions.properties).toEqual({ id: 'gep-test-cog' })
    expect(layerOptions.opacity).toBe(0.8)
    expect(layerOptions.style.color).toEqual(['band', 1])
  })
})
