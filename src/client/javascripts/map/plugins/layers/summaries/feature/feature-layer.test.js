import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('ol/layer/VectorTile.js', () => ({
  default: vi.fn().mockImplementation(function (opts) {
    this._style = opts.style
    this._visible = opts.visible !== false
    this.changed = vi.fn()
    this.setStyle = vi.fn((fn) => { this._style = fn })
    this.setVisible = vi.fn((v) => { this._visible = v })
    this.setSource = vi.fn((s) => { this._source = s })
  })
}))

vi.mock('ol/source/OGCVectorTile.js', () => ({
  default: vi.fn().mockImplementation(function (opts) {
    this._opts = opts
  })
}))

vi.mock('ol/style/Style.js', () => ({
  default: vi.fn().mockImplementation(function () {
    this.type = 'style'
  })
}))

vi.mock('ol/style/Fill.js', () => ({
  default: vi.fn()
}))

vi.mock('ol/style/Stroke.js', () => ({
  default: vi.fn()
}))

const OGCVectorTile = (await import('ol/source/OGCVectorTile.js')).default
const { createFeatureLayer } = await import('./feature-layer.js')

const TILESET_URL = '/os/ngd/collections/ngd-base/tiles/27700'

function makeFeature (props) {
  return { get: (key) => props[key] ?? null }
}

function createOlMapMock (source = { id: 'basemap-source' }) {
  const basemapLayer = { getSource: vi.fn(() => source) }
  return {
    getLayers: vi.fn(() => ({
      item: vi.fn((index) => index === 0 ? basemapLayer : null)
    })),
    addLayer: vi.fn(),
    forEachFeatureAtPixel: vi.fn(),
    _source: source
  }
}

describe('#createFeatureLayer', () => {
  let olMap

  beforeEach(() => {
    olMap = createOlMapMock()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('refreshSource(true) shares the basemap source', () => {
    const layer = createFeatureLayer(olMap, TILESET_URL)
    layer.refreshSource(true)

    expect(olMap.addLayer).toHaveBeenCalledTimes(1)
    const overlayLayer = olMap.addLayer.mock.calls[0][0]
    expect(overlayLayer.setSource).toHaveBeenCalledWith(olMap._source)
    expect(OGCVectorTile).not.toHaveBeenCalled()
  })

  test('refreshSource(false) creates a dedicated NGD source', () => {
    const layer = createFeatureLayer(olMap, TILESET_URL)
    layer.refreshSource(false)

    const overlayLayer = olMap.addLayer.mock.calls[0][0]
    expect(overlayLayer.setSource).toHaveBeenLastCalledWith(expect.any(OGCVectorTile))
    expect(OGCVectorTile).toHaveBeenCalledWith(expect.objectContaining({
      url: TILESET_URL,
      projection: 'EPSG:27700'
    }))
  })

  test('reuses the dedicated source across refreshes', () => {
    const layer = createFeatureLayer(olMap, TILESET_URL)
    layer.refreshSource(false)
    layer.refreshSource(false)

    expect(OGCVectorTile).toHaveBeenCalledTimes(1)
  })

  test('refreshSource re-reads the basemap source after a style switch', () => {
    const layer = createFeatureLayer(olMap, TILESET_URL)
    layer.refreshSource(true)

    const newSource = { id: 'new-basemap-source' }
    olMap.getLayers = vi.fn(() => ({
      item: vi.fn(() => ({ getSource: vi.fn(() => newSource) }))
    }))
    layer.refreshSource(true)

    const overlayLayer = olMap.addLayer.mock.calls[0][0]
    expect(overlayLayer.setSource).toHaveBeenLastCalledWith(newSource)
  })

  test('overlay layer starts hidden', () => {
    createFeatureLayer(olMap, TILESET_URL)

    const overlayLayer = olMap.addLayer.mock.calls[0][0]
    expect(overlayLayer._visible).toBe(false)
  })

  test('selectFeature triggers a redraw', () => {
    const layer = createFeatureLayer(olMap, TILESET_URL)

    layer.selectFeature('abc-123')

    const overlayLayer = olMap.addLayer.mock.calls[0][0]
    expect(overlayLayer.changed).toHaveBeenCalled()
  })

  test('clearSelection triggers a redraw', () => {
    const layer = createFeatureLayer(olMap, TILESET_URL)

    layer.clearSelection()

    const overlayLayer = olMap.addLayer.mock.calls[0][0]
    expect(overlayLayer.changed).toHaveBeenCalled()
  })

  test('setEnabled toggles layer visibility', () => {
    const layer = createFeatureLayer(olMap, TILESET_URL)
    const overlayLayer = olMap.addLayer.mock.calls[0][0]

    layer.setEnabled(false)
    expect(overlayLayer.setVisible).toHaveBeenCalledWith(false)

    layer.setEnabled(true)
    expect(overlayLayer.setVisible).toHaveBeenCalledWith(true)
  })

  test('style function returns undefined for non-land features', () => {
    createFeatureLayer(olMap, TILESET_URL)
    const overlayLayer = olMap.addLayer.mock.calls[0][0]
    const styleFn = overlayLayer._style

    expect(styleFn(makeFeature({ layer: 'trn_fts_road' }))).toBeUndefined()
  })

  test('style function returns a different style for the selected feature', () => {
    const layer = createFeatureLayer(olMap, TILESET_URL)
    layer.selectFeature('abc-123')

    const overlayLayer = olMap.addLayer.mock.calls[0][0]
    const styleFn = overlayLayer._style

    const selectedStyle = styleFn(makeFeature({ layer: 'lnd_fts_land', osid: 'abc-123' }))
    const outlineStyle = styleFn(makeFeature({ layer: 'lnd_fts_land', osid: 'other-456' }))
    expect(selectedStyle).toBeDefined()
    expect(outlineStyle).toBeDefined()
    expect(selectedStyle).not.toBe(outlineStyle)
  })

  test('findFeatureAtPixel passes layerFilter restricting to overlay layer', () => {
    const layer = createFeatureLayer(olMap, TILESET_URL)

    olMap.forEachFeatureAtPixel.mockImplementation(() => {})
    layer.findFeatureAtPixel([100, 200])

    const opts = olMap.forEachFeatureAtPixel.mock.calls[0][2]
    expect(opts).toBeDefined()
    expect(typeof opts.layerFilter).toBe('function')

    const overlayLayer = olMap.addLayer.mock.calls[0][0]
    expect(opts.layerFilter(overlayLayer)).toBe(true)
    expect(opts.layerFilter({ other: true })).toBe(false)
  })

  test('findFeatureAtPixel returns matching feature data', () => {
    const layer = createFeatureLayer(olMap, TILESET_URL)

    olMap.forEachFeatureAtPixel.mockImplementation((pixel, callback) => {
      callback(makeFeature({ layer: 'lnd_fts_land', osid: 'abc-123', description: 'Arable Land' }))
    })

    const result = layer.findFeatureAtPixel([100, 200])
    expect(result).toEqual({ osid: 'abc-123', description: 'Arable Land' })
  })

  test('findFeatureAtPixel returns null when no land feature found', () => {
    const layer = createFeatureLayer(olMap, TILESET_URL)

    olMap.forEachFeatureAtPixel.mockImplementation((pixel, callback) => {
      callback(makeFeature({ layer: 'trn_fts_road' }))
    })

    expect(layer.findFeatureAtPixel([100, 200])).toBeNull()
  })
})
