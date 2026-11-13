// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach } from 'vitest'
import Polygon from 'ol/geom/Polygon.js'
import { createFeatureSummary } from './index.jsx'
import { toFeatureRecord } from './data.js'

const PROPERTIES = {
  osid: 'parcel-1',
  land_cover_dominant_value: 'Improved grass',
  land_cover_intersections_json: '[{"mapped_value":"Improved grass","intersection_area":100,"intersection_pct":100}]'
}
const SOURCES = { land_cover: { name: 'UKCEH Land Cover Map', date: '2026-10-21T10:47:51.297Z' } }

const COORDS = [418700, 385100]

const FEATURES_LAYER = {
  id: 'features',
  ready: true,
  source: {
    type: 'fgb',
    url: '/data.fgb',
    dataSources: SOURCES,
    styleConfig: {
      themes: [{
        label: 'Land cover',
        type: 'uniform',
        band: 1,
        classes: [{ bandValue: 1, label: 'OS feature', fill: [59, 104, 0, 1] }]
      }]
    }
  }
}

function square (size) {
  return new Polygon([[[0, 0], [size, 0], [size, size], [0, size], [0, 0]]])
}

function stubFeature (properties, geometry = square(10)) {
  return {
    get: key => properties[key],
    getGeometryName: () => 'geometry',
    getGeometry: () => geometry,
    getProperties: () => properties
  }
}

function soil (area) {
  return JSON.stringify([{ mapped_value: 'Brown soils', intersection_area: area, intersection_pct: 100 }])
}

describe('#createFeatureSummary', () => {
  let featuresUnderPointer
  let pointerLayer
  let layers
  let map

  const detailLayer = { get: () => 'gep-features' }

  beforeEach(() => {
    featuresUnderPointer = []
    pointerLayer = detailLayer
    layers = [FEATURES_LAYER]
    map = {
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
      getPixelFromCoordinate: vi.fn(() => [100, 200]),
      forEachFeatureAtPixel: (_pixel, callback, options) => {
        if (options.layerFilter(pointerLayer)) {
          featuresUnderPointer.forEach(feature => callback(feature, pointerLayer))
        }
      },
      getLayers: vi.fn(() => ({ getArray: () => [] }))
    }
  })

  function createSummary () {
    return createFeatureSummary(map, () => layers)
  }

  function highlighted () {
    return map.addLayer.mock.calls[0][0].getSource().getFeatures().map(feature => feature.getGeometry())
  }

  function toggleAt (summary, feature) {
    featuresUnderPointer = feature ? [feature] : []
    return summary.selection.toggleAt(COORDS)
  }

  test('a plain click yields the OS feature\'s land summary with the release\'s sources', async () => {
    const summary = createSummary()
    featuresUnderPointer = [stubFeature(PROPERTIES)]

    const [hit] = summary.getHits(COORDS)
    const details = await hit.loadDetails()

    expect(hit.label).toBe('OS feature')
    expect(details).toEqual(toFeatureRecord(PROPERTIES, SOURCES))
    expect(details.landCover.source.name).toBe('UKCEH Land Cover Map')
    expect(hit.render(details).props.record).toBe(details)
  })

  test('selecting the hit highlights the OS feature', () => {
    const summary = createSummary()
    const clicked = stubFeature({ osid: 'a' })
    featuresUnderPointer = [clicked]

    summary.getHits(COORDS)[0].select()

    expect(highlighted()).toEqual([clicked.getGeometry()])
  })

  test('with several OS features under the pointer, the hit is the first one and only it is highlighted', async () => {
    const summary = createSummary()
    const first = stubFeature({ osid: 'a' }, square(10))
    featuresUnderPointer = [first, stubFeature({ osid: 'b' }, square(20))]

    const hits = summary.getHits(COORDS)
    hits[0].select()

    expect(hits).toHaveLength(1)
    expect((await hits[0].loadDetails()).unit).toEqual({ kind: 'feature', osid: 'a' })
    expect(highlighted()).toEqual([first.getGeometry()])
  })

  test('no OS feature under the pointer yields no hits', () => {
    expect(createSummary().getHits(COORDS)).toEqual([])
  })

  test('features of other layers under the pointer yield no hits', () => {
    const summary = createSummary()
    featuresUnderPointer = [stubFeature({ osid: 'a' })]
    pointerLayer = { get: () => 'gep-woodland' }

    expect(summary.getHits(COORDS)).toEqual([])
  })

  test('an OS feature whose properties cannot be read fails when its details load', async () => {
    const summary = createSummary()
    const unreadable = stubFeature({ osid: 'a', soil_intersections_json: '{' })
    featuresUnderPointer = [unreadable]

    const [hit] = summary.getHits(COORDS)

    await expect(hit.loadDetails()).rejects.toThrow(SyntaxError)
    expect(toggleAt(summary, unreadable)).toBe(true)
    await expect(summary.selection.loadDetails()).rejects.toThrow(SyntaxError)
  })

  test.each([
    ['hidden', [{ ...FEATURES_LAYER, hidden: true }]],
    ['not ready', [{ ...FEATURES_LAYER, ready: false }]],
    ['off', []]
  ])('yields no hits while the OS features layer is %s', (_state, layerStates) => {
    const summary = createSummary()
    featuresUnderPointer = [stubFeature({ osid: 'a' })]
    layers = layerStates

    expect(summary.getHits(COORDS)).toEqual([])
  })

  test('a hit stops being valid when the OS features layer is hidden', () => {
    const summary = createSummary()
    featuresUnderPointer = [stubFeature({ osid: 'a' })]
    const [hit] = summary.getHits(COORDS)

    expect(hit.stillValid()).toBe(true)

    layers = [{ ...FEATURES_LAYER, hidden: true }]

    expect(hit.stillValid()).toBe(false)
  })

  test('clearSelection clears the highlight', () => {
    const summary = createSummary()
    featuresUnderPointer = [stubFeature({ osid: 'a' })]
    summary.getHits(COORDS)[0].select()

    summary.clearSelection()

    expect(highlighted()).toEqual([])
  })

  test('dispose removes the highlight layer', () => {
    const summary = createSummary()

    summary.dispose()

    expect(map.removeLayer).toHaveBeenCalledWith(map.addLayer.mock.calls[0][0])
  })

  describe('selection', () => {
    let summary
    let selection

    beforeEach(() => {
      summary = createSummary()
      selection = summary.selection
    })

    test('toggling an OS feature selects and highlights it straight away', () => {
      const feature = stubFeature({ osid: 'a' })

      expect(toggleAt(summary, feature)).toBe(true)

      expect(selection.isEmpty()).toBe(false)
      expect(selection.title()).toBe('OS feature')
      expect(selection.label()).toBe('1 OS feature selected')
      expect(highlighted()).toEqual([feature.getGeometry()])
    })

    test('adds and removes OS features', () => {
      const first = stubFeature({ osid: 'a' }, square(10))
      const second = stubFeature({ osid: 'b' }, square(20))
      toggleAt(summary, first)
      toggleAt(summary, second)

      expect(selection.title()).toBe('OS features')
      expect(selection.label()).toBe('2 OS features selected')
      expect(highlighted()).toEqual([first.getGeometry(), second.getGeometry()])

      toggleAt(summary, first)

      expect(selection.label()).toBe('1 OS feature selected')
      expect(highlighted()).toEqual([second.getGeometry()])
    })

    test('removes an OS feature by its osid after the loader has reloaded it', () => {
      toggleAt(summary, stubFeature({ osid: 'a' }))

      toggleAt(summary, stubFeature({ osid: 'a' }))

      expect(selection.isEmpty()).toBe(true)
    })

    test('carries on from an OS feature chosen by a plain click', () => {
      featuresUnderPointer = [stubFeature({ osid: 'a' })]
      summary.getHits(COORDS)[0].select()

      toggleAt(summary, stubFeature({ osid: 'b' }))

      expect(selection.label()).toBe('2 OS features selected')
    })

    test('nothing changes with no OS feature under the pointer', () => {
      toggleAt(summary, stubFeature({ osid: 'a' }))

      expect(toggleAt(summary, null)).toBe(false)
      expect(selection.label()).toBe('1 OS feature selected')
    })

    test('nothing changes and the selection is no longer valid while the layer is hidden', () => {
      toggleAt(summary, stubFeature({ osid: 'a' }))

      expect(selection.stillValid()).toBe(true)

      layers = [{ ...FEATURES_LAYER, hidden: true }]

      expect(toggleAt(summary, stubFeature({ osid: 'b' }))).toBe(false)
      expect(selection.label()).toBe('1 OS feature selected')
      expect(selection.stillValid()).toBe(false)
    })

    test('clearSelection empties the selection', () => {
      toggleAt(summary, stubFeature({ osid: 'a' }))

      summary.clearSelection()

      expect(selection.isEmpty()).toBe(true)
      expect(highlighted()).toEqual([])
    })

    test('a selection of one renders as the plain-click summary', async () => {
      toggleAt(summary, stubFeature(PROPERTIES))

      const details = await selection.loadDetails()
      const view = selection.render(details)

      expect(details.record).toEqual(toFeatureRecord(PROPERTIES, SOURCES))
      expect(view.props.unit).toEqual({ kind: 'feature', osid: 'parcel-1' })
    })

    test('combines the selected OS features by their geometry\'s area', async () => {
      toggleAt(summary, stubFeature({ osid: 'a', soil_intersections_json: soil(300) }, square(20)))
      toggleAt(summary, stubFeature({ osid: 'b' }, square(10)))

      const details = await selection.loadDetails()

      expect(details.units).toEqual([{ kind: 'feature', osid: 'a' }, { kind: 'feature', osid: 'b' }])
      expect(details.record.soils.intersections).toEqual([{ label: 'Brown soils', area: 300, percentage: 60 }])
      expect(selection.render(details).props.header.props).toEqual({ count: 2, label: 'OS features' })
    })
  })
})
