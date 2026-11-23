import { vi, describe, test, expect } from 'vitest'

vi.mock('flatgeobuf/lib/mjs/ol.js', () => ({
  deserialize: vi.fn()
}))

const { default: Feature } = await import('ol/Feature.js')
const { default: Polygon, fromExtent } = await import('ol/geom/Polygon.js')
const { deserialize } = await import('flatgeobuf/lib/mjs/ol.js')
const { featuresIntersecting, readFeaturesInExtent } = await import('./features-in-polygon.js')

const POLYGON = fromExtent([0, 0, 100, 100])

async function * streamOf (features) {
  yield * features
}

function featureOver (geometry) {
  return new Feature({ geometry })
}

describe('#featuresIntersecting', () => {
  test('keeps a feature crossing its edge', () => {
    const feature = featureOver(fromExtent([90, 40, 120, 60]))

    expect(featuresIntersecting(POLYGON, [feature])).toEqual([feature])
  })

  test('leaves out a feature outside the polygon', () => {
    expect(featuresIntersecting(POLYGON, [featureOver(fromExtent([200, 200, 300, 300]))])).toEqual([])
  })

  test('leaves out a feature in the extent of a concave polygon but outside it', () => {
    const lShape = new Polygon([[[0, 0], [100, 0], [100, 50], [50, 50], [50, 100], [0, 100], [0, 0]]])

    expect(featuresIntersecting(lShape, [featureOver(fromExtent([60, 60, 90, 90]))])).toEqual([])
  })
})

describe('#readFeaturesInExtent', () => {
  test('reads the features in the extent from the file', async () => {
    const features = [new Feature({ osid: 'a' }), new Feature({ osid: 'b' })]
    deserialize.mockReturnValueOnce(streamOf(features))

    const read = await readFeaturesInExtent('/data.fgb', [1, 2, 3, 4], { signal: new AbortController().signal })

    expect(read).toEqual(features)
    expect(deserialize).toHaveBeenCalledWith('/data.fgb', { rect: { minX: 1, minY: 2, maxX: 3, maxY: 4 } })
  })

  test('rejects an already-aborted lookup when the stream yields a feature', async () => {
    const controller = new AbortController()
    controller.abort()
    deserialize.mockReturnValueOnce(streamOf([new Feature({ osid: 'a' })]))

    await expect(readFeaturesInExtent('/data.fgb', [1, 2, 3, 4], { signal: controller.signal })).rejects.toThrow()
  })
})
