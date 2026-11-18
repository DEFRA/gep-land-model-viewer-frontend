import { vi, describe, test, expect, beforeEach } from 'vitest'
import { fromExtent } from 'ol/geom/Polygon.js'
import { SELECTION_Z_INDEX } from '../../../config/layers.js'
import { createOutline } from './outline.js'

describe('#createOutline', () => {
  let map

  beforeEach(() => {
    map = { addLayer: vi.fn(), removeLayer: vi.fn() }
  })

  function layer () {
    return map.addLayer.mock.calls[0][0]
  }

  function outlined () {
    return layer().getSource().getFeatures().map(feature => feature.getGeometry())
  }

  test('draws a dashed outline above the selection highlights', () => {
    createOutline(map)

    expect(layer().getZIndex()).toBe(SELECTION_Z_INDEX + 1)
    expect(layer().getStyle().getStroke().getLineDash()).toEqual([8, 6])
    expect(layer().getStyle().getFill()).toBeNull()
  })

  test('show replaces the outline with the polygon', () => {
    const outline = createOutline(map)
    const second = fromExtent([0, 0, 20, 20])

    outline.show(fromExtent([0, 0, 10, 10]))
    outline.show(second)

    expect(outlined()).toEqual([second])
  })

  test('clear removes the outline', () => {
    const outline = createOutline(map)
    outline.show(fromExtent([0, 0, 10, 10]))

    outline.clear()

    expect(outlined()).toEqual([])
  })

  test('dispose removes its layer', () => {
    const outline = createOutline(map)

    outline.dispose()

    expect(map.removeLayer).toHaveBeenCalledWith(layer())
  })
})
