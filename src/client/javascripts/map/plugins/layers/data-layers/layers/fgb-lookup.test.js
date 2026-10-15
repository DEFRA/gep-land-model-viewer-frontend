import { vi, describe, test, expect, beforeEach } from 'vitest'

vi.mock('flatgeobuf/lib/mjs/geojson.js', () => ({
  deserialize: vi.fn()
}))

const { deserialize } = await import('flatgeobuf/lib/mjs/geojson.js')
const { queryFgbNearPoint } = await import('./fgb-lookup.js')

const URL = '/vector/test.fgb'
const POINT = [10, 10]
const RESOLUTION = 2

function polygonFeature (ring, properties = {}) {
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties }
}

const CONTAINING = polygonFeature([[0, 0], [20, 0], [20, 20], [0, 20], [0, 0]], { name: 'inside' })
// Closest point to POINT is (20, 20), 200 map units squared away.
const NEARBY = polygonFeature([[20, 20], [30, 20], [30, 30], [20, 30], [20, 20]], { name: 'nearby' })
const ELSEWHERE = polygonFeature([[100, 100], [120, 100], [120, 120], [100, 120], [100, 100]], { name: 'outside' })

function yields (...features) {
  return async function * () {
    for (const feature of features) {
      yield feature
    }
  }
}

describe('#queryFgbNearPoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns the feature containing the point', async () => {
    deserialize.mockImplementation(yields(ELSEWHERE, CONTAINING))

    const match = await queryFgbNearPoint(URL, POINT, RESOLUTION)

    expect(match).toBe(CONTAINING)
    expect(deserialize).toHaveBeenCalledTimes(1)
  })

  test('queries a pixel-sized box around the point', async () => {
    deserialize.mockImplementation(yields(CONTAINING))

    await queryFgbNearPoint(URL, POINT, RESOLUTION)

    expect(deserialize).toHaveBeenCalledWith(URL, { minX: 4, minY: 4, maxX: 16, maxY: 16 })
  })

  test('escalates the search box when nothing matches', async () => {
    deserialize
      .mockImplementationOnce(yields())
      .mockImplementationOnce(yields(CONTAINING))

    const match = await queryFgbNearPoint(URL, POINT, RESOLUTION)

    expect(match).toBe(CONTAINING)
    expect(deserialize).toHaveBeenCalledTimes(2)
    expect(deserialize.mock.calls[1][1]).toEqual({ minX: -6, minY: -6, maxX: 26, maxY: 26 })
  })

  test('returns the nearest candidate once a tolerance reaches it', async () => {
    deserialize.mockImplementation(yields(NEARBY))

    const match = await queryFgbNearPoint(URL, POINT, RESOLUTION)

    // 200 squared units away: outside the 6-unit box, inside the 16-unit one.
    expect(match).toBe(NEARBY)
    expect(deserialize).toHaveBeenCalledTimes(2)
  })

  test('a containing feature beats a nearer boundary', async () => {
    deserialize.mockImplementation(yields(NEARBY, CONTAINING))

    const match = await queryFgbNearPoint(URL, POINT, RESOLUTION)

    expect(match).toBe(CONTAINING)
  })

  test('returns null when nothing contains or comes near the point', async () => {
    deserialize.mockImplementation(yields(ELSEWHERE))

    const match = await queryFgbNearPoint(URL, POINT, RESOLUTION)

    expect(match).toBeNull()
    expect(deserialize).toHaveBeenCalledTimes(3)
  })

  test('stops consuming candidates at the cap instead of streaming forever', async () => {
    deserialize.mockImplementation(async function * () {
      while (true) {
        yield ELSEWHERE
      }
    })

    const match = await queryFgbNearPoint(URL, POINT, RESOLUTION)

    expect(match).toBeNull()
  })

  test('hitting the cap still returns the best candidate seen', async () => {
    deserialize.mockImplementation(async function * () {
      while (true) {
        yield NEARBY
      }
    })

    const match = await queryFgbNearPoint(URL, POINT, RESOLUTION)

    expect(match).toBe(NEARBY)
  })

  test('an aborted signal stops the query', async () => {
    deserialize.mockImplementation(yields(CONTAINING))
    const controller = new AbortController()
    controller.abort()

    await expect(queryFgbNearPoint(URL, POINT, RESOLUTION, { signal: controller.signal }))
      .rejects.toThrow()
  })
})
