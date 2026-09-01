// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'
import Polygon from 'ol/geom/Polygon.js'
import { render } from '@testing-library/preact'

vi.mock('../../../config/datasets.js', () => ({
  datasets: [
    {
      id: 'woodland',
      label: 'Ancient Woodland',
      source: {
        type: 'fgb',
        url: '/vector/woodland.fgb',
        styleConfig: {
          type: 'uniform',
          classes: [{ bandValue: 1, label: 'Ancient Woodland', fill: [59, 104, 0, 1] }]
        }
      }
    },
    {
      id: 'peat',
      label: 'Peaty Soils',
      source: {
        type: 'cog',
        url: '/raster/peat.tif',
        styleConfig: {
          type: 'range',
          minValue: 0,
          classes: [
            { maxValue: 20, label: 'Up to 20cm', fill: [204, 204, 255, 1] }
          ],
          default: { label: 'Over 20cm', fill: [0, 0, 224, 1] }
        }
      }
    },
    { id: 'flood', label: 'Flood Zones', source: { type: 'wms', url: 'https://example.com/wms' } },
    {
      id: 'habitats',
      label: 'Living England',
      source: {
        type: 'fgb',
        url: '/vector/habitats.fgb',
        minZoom: 5,
        styleConfig: {
          type: 'match',
          field: 'A_pred',
          classes: [{ bandValue: 2, fieldValues: ['Water'], label: 'Water', fill: [190, 232, 255, 1] }],
          default: { label: 'Other', fill: [0, 0, 0, 0] }
        },
        overview: { type: 'cog', url: '/raster/habitats.tif' }
      }
    }
  ]
}))

vi.mock('./layers/wms.js', () => ({
  getVisibleWmsLayers: vi.fn(() => []),
  getSourceUrl: vi.fn(() => 'https://example.com/wms')
}))

vi.mock('../../../pointer.js', () => ({
  isCoarsePointer: vi.fn(() => false)
}))

vi.mock('./layers/fgb-lookup.js', () => ({
  queryFgbNearPoint: vi.fn(async () => null)
}))

const { isCoarsePointer } = await import('../../../pointer.js')
const { datasets } = await import('../../../config/datasets.js')
const { getVisibleWmsLayers } = await import('./layers/wms.js')
const { queryFgbNearPoint } = await import('./layers/fgb-lookup.js')
const { createDatasetHits } = await import('./hits.jsx')

const COORDS = [418700, 385100]
const SIGNAL = new AbortController().signal

const GEOMETRY = new Polygon([[[0, 0], [20, 0], [20, 20], [0, 20], [0, 0]]])

function stubLayer (id, { visible = true } = {}) {
  return {
    get: vi.fn((key) => (key === 'id' ? id : undefined)),
    getVisible: vi.fn(() => visible)
  }
}

const MATCH_STYLE_CONFIG = {
  type: 'match',
  field: 'A_pred',
  classes: [{ bandValue: 2, fieldValues: ['Water'], label: 'Water', fill: [190, 232, 255, 1] }],
  default: { label: 'Other', fill: [0, 0, 0, 0] }
}

function stubCogOverviewLayer ({ visible = true, bands = new Float32Array([2]) } = {}) {
  const properties = { id: 'gep-habitats-overview' }
  return {
    get: vi.fn((key) => properties[key]),
    getVisible: vi.fn(() => visible),
    getData: vi.fn(() => bands)
  }
}

function stubDetailLayer ({ visible = true, minZoom = 4 } = {}) {
  return {
    ...stubLayer('gep-habitats', { visible }),
    getMinZoom: vi.fn(() => minZoom)
  }
}

function stubFeature (properties, geometryName = 'geometry') {
  return {
    get: key => properties[key],
    getGeometryName: geometryName ? () => geometryName : undefined,
    getGeometry: () => GEOMETRY,
    getProperties: () => properties
  }
}

function createOlMap ({ vectorHits = [], layers = [], zoom = 2 } = {}) {
  return {
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
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
      getZoom: vi.fn(() => zoom),
      calculateExtent: vi.fn(() => [418000, 384000, 419000, 386000])
    })),
    getSize: vi.fn(() => [800, 600])
  }
}

function getHits (map) {
  return createDatasetHits(map, datasets).getHits(COORDS, { signal: SIGNAL })
}

function highlightedFeatures (map) {
  return map.addLayer.mock.calls[0][0].getSource().getFeatures()
}

describe('#createDatasetHits', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    isCoarsePointer.mockReset()
    isCoarsePointer.mockReturnValue(false)
    getVisibleWmsLayers.mockReset()
    getVisibleWmsLayers.mockReturnValue([])
    queryFgbNearPoint.mockReset()
    queryFgbNearPoint.mockResolvedValue(null)
    datasets.find((dataset) => dataset.id === 'habitats').source.styleConfig = MATCH_STYLE_CONFIG
  })

  afterEach(() => {
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

  test('a standalone source-value COG classifies its pixel and reports the class label', async () => {
    const layer = {
      ...stubLayer('gep-peat'),
      getVisible: vi.fn(() => true),
      getData: vi.fn(() => new Float32Array([7, 255]))
    }
    const map = createOlMap({ layers: [layer] })

    const hits = await getHits(map)

    expect(hits).toHaveLength(1)
    expect(hits[0].label).toBe('Peaty Soils')
    await expect(hits[0].loadDetails({ signal: SIGNAL })).resolves.toEqual([{ Classification: 'Up to 20cm' }])
  })

  test('a masked COG pixel yields no hit', async () => {
    const layer = {
      ...stubLayer('gep-peat'),
      getVisible: vi.fn(() => true),
      getData: vi.fn(() => new Float32Array([7, 0]))
    }
    const map = createOlMap({ layers: [layer] })

    await expect(getHits(map)).resolves.toEqual([])
  })

  test('a COG overview hit loads the FlatGeobuf feature and its attributes', async () => {
    queryFgbNearPoint.mockResolvedValue({
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 0]]] },
      properties: { A_pred: 'Water', area: 3 }
    })
    const map = createOlMap({ layers: [stubCogOverviewLayer(), stubDetailLayer()], zoom: 2 })

    const hits = await getHits(map)

    expect(hits).toHaveLength(1)
    expect(hits[0].label).toBe('Living England')

    hits[0].select()
    expect(highlightedFeatures(map)).toHaveLength(0)

    const details = await hits[0].loadDetails({ signal: SIGNAL })

    expect(queryFgbNearPoint).toHaveBeenCalledWith('/vector/habitats.fgb', COORDS, 50, { signal: SIGNAL })
    expect(details).toEqual([{ A_pred: 'Water', area: 3 }])
    expect(highlightedFeatures(map)).toHaveLength(1)
  })

  test('a class with one fieldValue reports that original attribute when the FlatGeobuf lookup misses', async () => {
    const map = createOlMap({ layers: [stubCogOverviewLayer(), stubDetailLayer()], zoom: 2 })

    const hits = await getHits(map)

    await expect(hits[0].loadDetails({ signal: SIGNAL })).resolves.toEqual([{ A_pred: 'Water' }])
  })

  test('a grouped match class reports its label when the FlatGeobuf lookup misses', async () => {
    datasets.find((dataset) => dataset.id === 'habitats').source.styleConfig = {
      ...MATCH_STYLE_CONFIG,
      classes: [{ bandValue: 2, fieldValues: ['Water', 'Canal'], label: 'Open water', fill: [190, 232, 255, 1] }]
    }
    const layers = [stubCogOverviewLayer(), stubDetailLayer()]
    const hits = await getHits(createOlMap({ layers, zoom: 2 }))

    await expect(hits[0].loadDetails({ signal: SIGNAL })).resolves.toEqual([{ Classification: 'Open water' }])
  })

  test('an exact detail hit takes precedence over the visible COG overview', async () => {
    const overview = stubCogOverviewLayer()
    const detail = stubDetailLayer()
    const feature = stubFeature({ geometry: {}, A_pred: 'Water', area: 3 })
    const map = createOlMap({
      vectorHits: [{ feature, layer: detail }],
      layers: [overview, detail],
      zoom: 6
    })

    const hits = await getHits(map)

    expect(hits).toHaveLength(1)
    await expect(hits[0].loadDetails({ signal: SIGNAL })).resolves.toEqual([{ A_pred: 'Water', area: 3 }])
    expect(overview.getData).not.toHaveBeenCalled()
    expect(queryFgbNearPoint).not.toHaveBeenCalled()
  })

  test('a COG overview hit remains valid while the dataset is visible', async () => {
    const detail = stubDetailLayer()
    const hits = await getHits(createOlMap({ layers: [stubCogOverviewLayer(), detail], zoom: 6 }))

    expect(hits[0].stillValid()).toBe(true)

    detail.getVisible.mockReturnValue(false)
    expect(hits[0].stillValid()).toBe(false)
  })

  test('visible false prevents a vector feature from yielding a hit', async () => {
    datasets.find((dataset) => dataset.id === 'habitats').source.styleConfig = {
      ...MATCH_STYLE_CONFIG,
      classes: [{ ...MATCH_STYLE_CONFIG.classes[0], visible: false }]
    }
    const detail = stubDetailLayer()
    const feature = stubFeature({ geometry: {}, A_pred: 'Water' })
    const map = createOlMap({
      vectorHits: [{ feature, layer: detail }]
    })

    await expect(getHits(map)).resolves.toEqual([])
  })

  test('visible false prevents a COG overview class from yielding a hit', async () => {
    datasets.find((dataset) => dataset.id === 'habitats').source.styleConfig = {
      ...MATCH_STYLE_CONFIG,
      classes: [{ ...MATCH_STYLE_CONFIG.classes[0], visible: false }]
    }
    const layers = [stubCogOverviewLayer(), stubDetailLayer()]

    await expect(getHits(createOlMap({ layers, zoom: 2 }))).resolves.toEqual([])
  })

  test('a hidden COG overview yields no hit', async () => {
    const layers = [stubCogOverviewLayer({ visible: false }), stubDetailLayer({ visible: false })]

    await expect(getHits(createOlMap({ layers, zoom: 2 }))).resolves.toEqual([])
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

  test('a hit renders attribute values as text, never as markup', async () => {
    const feature = stubFeature({ geometry: {}, name: '<script>alert(1)</script>' })
    const map = createOlMap({ vectorHits: [{ feature, layer: stubLayer('gep-woodland') }] })

    const hits = await getHits(map)
    const view = render(hits[0].render(await hits[0].loadDetails({ signal: SIGNAL })))

    expect(view.container.querySelector('script')).toBeNull()
    expect(view.container.textContent).toContain('<script>alert(1)</script>')
  })

  test('selecting a detail feature hit highlights its geometry', async () => {
    const feature = stubFeature({ geometry: {}, A_pred: 'Bog' })
    const map = createOlMap({ vectorHits: [{ feature, layer: stubLayer('gep-woodland') }] })

    const hits = await getHits(map)
    hits[0].select()

    expect(highlightedFeatures(map)).toHaveLength(1)
    expect(highlightedFeatures(map)[0].getGeometry()).toBe(GEOMETRY)
  })

  test('selecting a standalone COG hit marks the sampled point', async () => {
    const layer = {
      ...stubLayer('gep-peat'),
      getVisible: vi.fn(() => true),
      getData: vi.fn(() => new Float32Array([7, 255]))
    }
    const map = createOlMap({ layers: [layer] })

    const hits = await getHits(map)
    hits[0].select()

    const [feature] = highlightedFeatures(map)
    expect(feature.getGeometry().getType()).toBe('Point')
    expect(feature.getGeometry().getCoordinates()).toEqual(COORDS)
    expect(feature.getStyle().getImage()).toBeTruthy()
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

    const source = createDatasetHits(map, datasets)
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

  test('dispose clears and removes its highlight layer', () => {
    const map = createOlMap()
    const source = createDatasetHits(map, datasets)
    const highlightLayer = map.addLayer.mock.calls[0][0]

    source.dispose()

    expect(highlightLayer.getSource().getFeatures()).toEqual([])
    expect(map.removeLayer).toHaveBeenCalledWith(highlightLayer)
  })

  test('a hit with no attributes renders an empty message', async () => {
    queryFgbNearPoint.mockResolvedValue(null)
    const feature = stubFeature({}, null)
    const map = createOlMap({ vectorHits: [{ feature, layer: stubLayer('gep-woodland-overview') }] })

    const hits = await getHits(map)
    const view = render(hits[0].render(await hits[0].loadDetails({ signal: SIGNAL })))

    expect(view.container.textContent).toContain('Ancient Woodland')
    expect(view.container.textContent).toContain('No attributes found at this location')
  })
})
