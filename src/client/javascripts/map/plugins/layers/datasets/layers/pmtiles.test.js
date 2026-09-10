import { vi, describe, test, expect, afterEach } from 'vitest'
import TileState from 'ol/TileState.js'

vi.mock('pmtiles', () => ({
  PMTiles: vi.fn().mockImplementation(function (url) {
    this.url = url
    this.getHeader = vi.fn().mockResolvedValue({ minZoom: 0, maxZoom: 9 })
    this.getZxy = vi.fn().mockResolvedValue({ data: new Uint8Array([1]).buffer })
  })
}))

vi.mock('ol/format/MVT.js', () => ({
  default: vi.fn().mockImplementation(function () {
    this.readFeatures = vi.fn(() => ['tile-feature'])
  })
}))

const { PMTiles } = await import('pmtiles')
const { default: MVT } = await import('ol/format/MVT.js')
const { createPmtilesLayer } = await import('./pmtiles.js')

const ARCHIVE_URL = 'https://example.com/data.pmtiles'

const STYLE_CONFIG = {
  type: 'uniform',
  classes: [{ bandValue: 1, fill: [178, 102, 204, 0.42], stroke: { color: [112, 48, 135, 0.8], width: 1.25 } }]
}

async function createLayer () {
  const datasetLayer = await createPmtilesLayer(ARCHIVE_URL, 'gep-test-overview', {
    styleConfig: STYLE_CONFIG,
    maxZoom: 4,
    opacity: 0.7
  })
  const archive = PMTiles.mock.instances.at(-1)
  const format = MVT.mock.instances.at(-1)

  return { datasetLayer, layer: datasetLayer.layers[0], archive, format }
}

function createTileStub () {
  return {
    setLoader: vi.fn(),
    setFeatures: vi.fn(),
    setState: vi.fn()
  }
}

async function loadTile (layer, tileUrl = '3/2/4') {
  const tile = createTileStub()
  layer.getSource().getTileLoadFunction()(tile, tileUrl)

  const [loader] = tile.setLoader.mock.calls[0]
  await loader([0, 0, 100, 100], 56, 'view-projection')

  return tile
}

describe('#createPmtilesLayer', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('builds a canvas vector tile layer against the archive Mercator grid', async () => {
    const { layer, archive } = await createLayer()

    expect(PMTiles).toHaveBeenCalledWith(ARCHIVE_URL)
    expect(archive.getHeader).toHaveBeenCalled()
    expect(layer.get('id')).toBe('gep-test-overview')
    expect(layer.getMaxZoom()).toBe(4)
    expect(layer.getOpacity()).toBe(0.7)

    const source = layer.getSource()
    expect(source.getProjection().getCode()).toBe('EPSG:3857')

    const tileGrid = source.getTileGrid()
    expect(tileGrid.getMinZoom()).toBe(0)
    expect(tileGrid.getMaxZoom()).toBe(9)
    expect(tileGrid.getTileSize(0)).toBe(512)
  })

  test('addresses tiles as z/x/y against the archive', async () => {
    const { layer } = await createLayer()
    const source = layer.getSource()

    expect(source.getTileUrlFunction()([3, 2, 4], 1, source.getProjection())).toBe('3/2/4')
  })

  test('applies fill, outline and opacity changes to the tile layer', async () => {
    const { datasetLayer, layer } = await createLayer()

    datasetLayer.applyStyle({
      type: 'uniform',
      classes: [{ ...STYLE_CONFIG.classes[0], fill: [255, 0, 0, 0.42], stroke: { color: [0, 0, 0, 0.8], width: 1.25 } }]
    })
    datasetLayer.setOpacity(0.4)

    expect(layer.getStyle()).toEqual({ 'fill-color': [255, 0, 0, 0.42], 'stroke-color': [0, 0, 0, 0.8], 'stroke-width': 1.25 })
    expect(layer.getOpacity()).toBe(0.4)
    layer.dispose()
  })

  test('tile loader reads MVT features from the archive into the tile', async () => {
    const { layer, archive, format } = await createLayer()

    const tile = await loadTile(layer)

    expect(archive.getZxy).toHaveBeenCalledWith(3, 2, 4)
    expect(format.readFeatures).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      { extent: [0, 0, 100, 100], featureProjection: 'view-projection' }
    )
    expect(tile.setFeatures).toHaveBeenCalledWith(['tile-feature'])
    expect(tile.setState).not.toHaveBeenCalled()
  })

  test('an address missing from the archive is an empty tile, not an error', async () => {
    const { layer, archive, format } = await createLayer()
    archive.getZxy.mockResolvedValue(undefined)

    const tile = await loadTile(layer)

    expect(tile.setFeatures).toHaveBeenCalledWith([])
    expect(format.readFeatures).not.toHaveBeenCalled()
    expect(tile.setState).not.toHaveBeenCalled()
  })

  test('an archive read failure marks the tile errored', async () => {
    const { layer, archive } = await createLayer()
    archive.getZxy.mockRejectedValue(new Error('range request failed'))

    const tile = await loadTile(layer)

    expect(tile.setFeatures).not.toHaveBeenCalled()
    expect(tile.setState).toHaveBeenCalledWith(TileState.ERROR)
  })
})
