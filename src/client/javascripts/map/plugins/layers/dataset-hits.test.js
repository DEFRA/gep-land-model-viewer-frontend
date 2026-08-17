// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'
import Polygon from 'ol/geom/Polygon.js'

vi.mock('../../config/datasets.js', () => ({
  datasets: [
    { id: 'woodland', label: 'Ancient Woodland', source: { type: 'fgb', url: '/vector/woodland.fgb' } },
    { id: 'peat', label: 'Peaty Soils', source: { type: 'cog', url: '/raster/peat.tif' } },
    { id: 'flood', label: 'Flood Zones', source: { type: 'wms', url: 'https://example.com/wms' } }
  ]
}))

vi.mock('./wms-layer.js', () => ({
  getVisibleWmsLayers: vi.fn(() => []),
  getSourceUrl: vi.fn(() => 'https://example.com/wms')
}))

vi.mock('../../pointer.js', () => ({
  isCoarsePointer: vi.fn(() => false)
}))

vi.mock('./fgb-lookup.js', () => ({
  queryFgbNearPoint: vi.fn(async () => null)
}))

const { isCoarsePointer } = await import('../../pointer.js')
const { getVisibleWmsLayers } = await import('./wms-layer.js')
const { queryFgbNearPoint } = await import('./fgb-lookup.js')
const { createDatasetHitSource } = await import('./dataset-hits.js')

const COORDS = [418700, 385100]
const SIGNAL = new AbortController().signal

const GEOMETRY = new Polygon([[[0, 0], [20, 0], [20, 20], [0, 20], [0, 0]]])

function stubLayer (id, { visible = true } = {}) {
  return {
    get: vi.fn((key) => (key === 'id' ? id : undefined)),
    getVisible: vi.fn(() => visible)
  }
}

function stubFeature (properties, geometryName = 'geometry') {
  return {
    getGeometryName: geometryName ? () => geometryName : undefined,
    getGeometry: () => GEOMETRY,
    getProperties: () => properties
  }
}

function createOlMap ({ vectorHits = [], layers = [] } = {}) {
  return {
    addLayer: vi.fn(),
    getPixelFromCoordinate: vi.fn(() => [100, 200]),
    forEachFeatureAtPixel: vi.fn((pixel, callback, options) => {
      for (const { feature, layer } of vectorHits) {
        if (options.layerFilter(layer)) {
          callback(feature, layer)
        }
      }
    }),
    getLayers: vi.fn(() => ({ getArray: () => layers })),
    getView: vi.fn(() => ({
      getResolution: vi.fn(() => 50),
      calculateExtent: vi.fn(() => [418000, 384000, 419000, 386000])
    })),
    getSize: vi.fn(() => [800, 600])
  }
}

function getHits (map) {
  return createDatasetHitSource(map).getHits(COORDS, { signal: SIGNAL })
}

function highlightedFeatures (map) {
  return map.addLayer.mock.calls[0][0].getSource().getFeatures()
}

describe('#createDatasetHitSource', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  test('a detail FlatGeobuf feature yields a hit with its properties', async () => {
    const feature = stubFeature({ geometry: {}, A_pred: 'Bog', area: 12 })
    const map = createOlMap({ vectorHits: [{ feature, layer: stubLayer('gep-woodland') }] })

    const hits = await getHits(map)

    expect(hits).toHaveLength(1)
    expect(hits[0].label).toBe('Ancient Woodland')
    expect(hits[0].panelTitle).toBe('Data layer attributes')
    await expect(hits[0].loadDetails({ signal: SIGNAL })).resolves.toEqual([{ A_pred: 'Bog', area: 12 }])
    expect(queryFgbNearPoint).not.toHaveBeenCalled()
  })

  test('an overview feature loads the real attributes from the FlatGeobuf', async () => {
    queryFgbNearPoint.mockResolvedValue({ properties: { A_pred: 'Bog' } })
    const feature = stubFeature({ A_pred: 'generalised' }, null)
    const map = createOlMap({ vectorHits: [{ feature, layer: stubLayer('gep-woodland-overview') }] })

    const hits = await getHits(map)
    const details = await hits[0].loadDetails({ signal: SIGNAL })

    expect(queryFgbNearPoint).toHaveBeenCalledWith('/vector/woodland.fgb', COORDS, 50, { signal: SIGNAL })
    expect(details).toEqual([{ A_pred: 'Bog' }])
  })

  test('overview picking allows a near-miss of a few pixels, detail picking is exact', async () => {
    const map = createOlMap()

    await getHits(map)

    const [detailPass, overviewPass] = map.forEachFeatureAtPixel.mock.calls
    expect(detailPass[2].hitTolerance).toBeUndefined()
    expect(overviewPass[2].hitTolerance).toBe(3)
  })

  test('overview picking gives touch input a wider near-miss', async () => {
    isCoarsePointer.mockReturnValueOnce(true)
    const map = createOlMap()

    await getHits(map)

    expect(map.forEachFeatureAtPixel.mock.calls[1][2].hitTolerance).toBe(12)
  })

  test('an overview click with no FlatGeobuf match loads empty details', async () => {
    queryFgbNearPoint.mockResolvedValue(null)
    const feature = stubFeature({}, null)
    const map = createOlMap({ vectorHits: [{ feature, layer: stubLayer('gep-woodland-overview') }] })

    const hits = await getHits(map)

    await expect(hits[0].loadDetails({ signal: SIGNAL })).resolves.toEqual([])
  })

  test('stacked features from the same dataset yield one hit with every record', async () => {
    const layer = stubLayer('gep-woodland')
    const map = createOlMap({
      vectorHits: [
        { feature: stubFeature({ geometry: {}, id: 1 }), layer },
        { feature: stubFeature({ geometry: {}, id: 2 }), layer }
      ]
    })

    const hits = await getHits(map)

    expect(hits).toHaveLength(1)
    await expect(hits[0].loadDetails({ signal: SIGNAL })).resolves.toEqual([{ id: 1 }, { id: 2 }])

    hits[0].select()
    expect(highlightedFeatures(map)).toHaveLength(2)
  })

  test('a detail feature is preferred when the overview layer also hits', async () => {
    const map = createOlMap({
      vectorHits: [
        { feature: stubFeature({ A_pred: 'generalised' }, null), layer: stubLayer('gep-woodland-overview') },
        { feature: stubFeature({ geometry: {}, A_pred: 'Bog' }), layer: stubLayer('gep-woodland') }
      ]
    })

    const hits = await getHits(map)

    expect(hits).toHaveLength(1)
    await expect(hits[0].loadDetails({ signal: SIGNAL })).resolves.toEqual([{ A_pred: 'Bog' }])
    expect(queryFgbNearPoint).not.toHaveBeenCalled()
  })

  test('a COG layer with data under the pixel yields its band values', async () => {
    const layer = {
      ...stubLayer('gep-peat'),
      getVisible: vi.fn(() => true),
      getData: vi.fn(() => new Float32Array([7, 3, 255]))
    }
    const map = createOlMap({ layers: [layer] })

    const hits = await getHits(map)

    expect(hits).toHaveLength(1)
    expect(hits[0].label).toBe('Peaty Soils')
    await expect(hits[0].loadDetails({ signal: SIGNAL })).resolves.toEqual([{ 'Band 1': 7, 'Band 2': 3 }])
  })

  test('a masked COG pixel yields no hit', async () => {
    const layer = {
      ...stubLayer('gep-peat'),
      getVisible: vi.fn(() => true),
      getData: vi.fn(() => new Float32Array([7, 3, 0]))
    }
    const map = createOlMap({ layers: [layer] })

    await expect(getHits(map)).resolves.toEqual([])
  })

  test('a WMS layer with features at the point yields a hit with them preloaded', async () => {
    const wmsLayer = {
      ...stubLayer('gep-flood'),
      getSource: vi.fn(() => ({ getParams: () => ({ LAYERS: 'Flood_Zones_2' }) }))
    }
    getVisibleWmsLayers.mockReturnValue([wmsLayer])
    fetch.mockResolvedValue({
      json: async () => ({ features: [{ properties: { zone: '2' } }, { properties: { zone: '3' } }] })
    })
    const map = createOlMap()

    const hits = await getHits(map)

    expect(hits).toHaveLength(1)
    expect(hits[0].label).toBe('Flood Zones')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('REQUEST=GetFeatureInfo'),
      { signal: SIGNAL }
    )
    await expect(hits[0].loadDetails({ signal: SIGNAL })).resolves.toEqual([{ zone: '2' }, { zone: '3' }])
  })

  test('a WMS layer with nothing at the point yields no hit', async () => {
    const wmsLayer = {
      ...stubLayer('gep-flood'),
      getSource: vi.fn(() => ({ getParams: () => ({ LAYERS: 'Flood_Zones_2' }) }))
    }
    getVisibleWmsLayers.mockReturnValue([wmsLayer])
    fetch.mockResolvedValue({ json: async () => ({ features: [] }) })

    await expect(getHits(createOlMap())).resolves.toEqual([])
  })

  test('a failed WMS request yields a hit whose details fail to load', async () => {
    const wmsLayer = {
      ...stubLayer('gep-flood'),
      getSource: vi.fn(() => ({ getParams: () => ({ LAYERS: 'Flood_Zones_2' }) }))
    }
    getVisibleWmsLayers.mockReturnValue([wmsLayer])
    fetch.mockRejectedValue(new Error('WMS down'))

    const hits = await getHits(createOlMap())

    expect(hits).toHaveLength(1)
    await expect(hits[0].loadDetails({ signal: SIGNAL })).rejects.toThrow('WMS down')
  })

  test('renderHtml escapes attribute values', async () => {
    const feature = stubFeature({ geometry: {}, name: '<script>alert(1)</script>' })
    const map = createOlMap({ vectorHits: [{ feature, layer: stubLayer('gep-woodland') }] })

    const hits = await getHits(map)
    const html = hits[0].renderHtml(await hits[0].loadDetails({ signal: SIGNAL }))

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  test('selecting a detail feature hit highlights its geometry', async () => {
    const feature = stubFeature({ geometry: {}, A_pred: 'Bog' })
    const map = createOlMap({ vectorHits: [{ feature, layer: stubLayer('gep-woodland') }] })

    const hits = await getHits(map)
    hits[0].select()

    expect(highlightedFeatures(map)).toHaveLength(1)
    expect(highlightedFeatures(map)[0].getGeometry()).toBe(GEOMETRY)
  })

  test('an overview hit highlights the geometry fetched from the FlatGeobuf', async () => {
    queryFgbNearPoint.mockResolvedValue({
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 0]]] },
      properties: { A_pred: 'Bog' }
    })
    const feature = stubFeature({}, null)
    const map = createOlMap({ vectorHits: [{ feature, layer: stubLayer('gep-woodland-overview') }] })

    const hits = await getHits(map)
    hits[0].select()
    expect(highlightedFeatures(map)).toHaveLength(0)

    await hits[0].loadDetails({ signal: SIGNAL })

    expect(highlightedFeatures(map)).toHaveLength(1)
  })

  test('selecting a WMS hit highlights the geometries GetFeatureInfo returned', async () => {
    const wmsLayer = {
      ...stubLayer('gep-flood'),
      getSource: vi.fn(() => ({ getParams: () => ({ LAYERS: 'Flood_Zones_2' }) }))
    }
    getVisibleWmsLayers.mockReturnValue([wmsLayer])
    fetch.mockResolvedValue({
      json: async () => ({
        features: [
          { properties: { zone: '2' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 0]]] } },
          { properties: { zone: '3' } }
        ]
      })
    })
    const map = createOlMap()

    const hits = await getHits(map)
    hits[0].select()

    expect(highlightedFeatures(map)).toHaveLength(1)
  })

  test('clearSelection removes the highlight', async () => {
    const feature = stubFeature({ geometry: {} })
    const map = createOlMap({ vectorHits: [{ feature, layer: stubLayer('gep-woodland') }] })

    const source = createDatasetHitSource(map)
    const hits = await source.getHits(COORDS, { signal: SIGNAL })
    hits[0].select()
    source.clearSelection()

    expect(highlightedFeatures(map)).toHaveLength(0)
  })

  test('a hit stops being valid when its layer is hidden', async () => {
    const layer = stubLayer('gep-woodland')
    const map = createOlMap({ vectorHits: [{ feature: stubFeature({ geometry: {} }), layer }] })

    const hits = await getHits(map)
    expect(hits[0].stillValid()).toBe(true)

    layer.getVisible.mockReturnValue(false)
    expect(hits[0].stillValid()).toBe(false)
  })

  test('renderHtml with no attributes shows an empty message', async () => {
    queryFgbNearPoint.mockResolvedValue(null)
    const feature = stubFeature({}, null)
    const map = createOlMap({ vectorHits: [{ feature, layer: stubLayer('gep-woodland-overview') }] })

    const hits = await getHits(map)
    const html = hits[0].renderHtml(await hits[0].loadDetails({ signal: SIGNAL }))

    expect(html).toContain('Ancient Woodland')
    expect(html).toContain('No attributes found at this location')
  })
})
