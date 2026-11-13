import { vi, describe, test, expect, beforeEach } from 'vitest'
import Point from 'ol/geom/Point.js'
import Polygon from 'ol/geom/Polygon.js'
import { createHighlight } from './highlight.js'

function square (size) {
  return new Polygon([[[0, 0], [size, 0], [size, size], [0, size], [0, 0]]])
}

describe('#createHighlight', () => {
  let map

  beforeEach(() => {
    map = { addLayer: vi.fn(), removeLayer: vi.fn() }
  })

  function highlighted () {
    return map.addLayer.mock.calls[0][0].getSource().getFeatures().map(feature => feature.getGeometry())
  }

  test('show highlights each geometry, replacing what was shown', () => {
    const highlight = createHighlight(map)
    const first = square(10)
    const second = square(20)

    highlight.show([first])
    highlight.show([second, undefined, first])

    expect(highlighted()).toEqual([second, first])
  })

  test('showPoint replaces the highlight with a point at the coords', () => {
    const highlight = createHighlight(map)
    highlight.show([square(10)])

    highlight.showPoint([418700, 385100])

    const [point] = highlighted()
    expect(highlighted()).toHaveLength(1)
    expect(point).toBeInstanceOf(Point)
    expect(point.getCoordinates()).toEqual([418700, 385100])
  })

  test('replacing or clearing the highlight stops listening to the highlighted geometry', () => {
    const highlight = createHighlight(map)
    const geometry = square(20)

    highlight.show([geometry])
    highlight.show([geometry])
    expect(geometry.getListeners('change')).toHaveLength(1)

    highlight.clear()
    expect(highlighted()).toEqual([])
    expect(geometry.getListeners('change')).toBeUndefined()
  })

  test('dispose clears the highlight and removes its layer', () => {
    const highlight = createHighlight(map)
    const geometry = square(10)
    highlight.show([geometry])

    highlight.dispose()

    expect(geometry.getListeners('change')).toBeUndefined()
    expect(map.removeLayer).toHaveBeenCalledWith(map.addLayer.mock.calls[0][0])
  })
})
