// @vitest-environment jsdom
import { vi, describe, test, expect, afterEach } from 'vitest'

vi.mock('ol/layer/Image.js', () => ({
  default: vi.fn().mockImplementation(function (opts) {
    this._opts = opts
  })
}))

vi.mock('ol/source/ImageWMS.js', () => ({
  default: vi.fn().mockImplementation(function (opts) {
    this._opts = opts
    this.getParams = vi.fn(() => opts?.params || {})
    this.getUrl = vi.fn(() => opts?.url)
  })
}))

const { default: ImageLayer } = await import('ol/layer/Image.js')
const { default: ImageWMS } = await import('ol/source/ImageWMS.js')
const {
  createWmsLayer,
  resetCapabilitiesCache,
  getSourceUrl,
  getVisibleWmsLayers
} = await import('./wms.js')

function wmsDataset (source = {}) {
  return {
    id: 'test-dataset',
    label: 'Test Dataset',
    source: {
      type: 'wms',
      url: 'https://example.com/wms',
      opacity: 0.7,
      attribution: 'Test Attribution',
      ...source
    }
  }
}

function makeCapabilitiesXml (layerNames) {
  const layers = layerNames.map(name =>
    `<Layer queryable="1"><Name>${name}</Name></Layer>`
  ).join('')
  return `<?xml version="1.0"?><WMS_Capabilities><Capability><Layer>${layers}</Layer></Capability></WMS_Capabilities>`
}

function stubGetCapabilities (layerNames = ['discovered_layer']) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    text: vi.fn().mockResolvedValue(makeCapabilitiesXml(layerNames))
  }))
}

describe('#createWmsLayer', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    resetCapabilitiesCache()
  })

  test('skips GetCapabilities when the dataset states its layers', async () => {
    vi.stubGlobal('fetch', vi.fn())

    await createWmsLayer(wmsDataset({ layers: ['layer1', 'layer2'] }), 'gep-test-dataset')

    expect(global.fetch).not.toHaveBeenCalled()
    expect(ImageWMS).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          LAYERS: 'layer1,layer2',
          CRS: 'EPSG:27700'
        })
      })
    )
  })

  test('discovers queryable layer names via GetCapabilities', async () => {
    stubGetCapabilities(['discovered_layer'])

    await createWmsLayer(wmsDataset(), 'gep-test-dataset')

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('GetCapabilities'))
    expect(ImageWMS).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/wms',
        attributions: 'Test Attribution',
        ratio: 1.5,
        params: expect.objectContaining({ LAYERS: 'discovered_layer' })
      })
    )
    expect(ImageLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: { id: 'gep-test-dataset', wms: true },
        opacity: 0.7
      })
    )
  })

  test('returns null when no queryable layers are found', async () => {
    stubGetCapabilities([])

    const layer = await createWmsLayer(wmsDataset(), 'gep-test-dataset')

    expect(layer).toBeNull()
    expect(ImageLayer).not.toHaveBeenCalled()
  })

  test('caches successful capabilities responses per service URL', async () => {
    stubGetCapabilities(['discovered_layer'])

    await createWmsLayer(wmsDataset(), 'gep-test-dataset')
    await createWmsLayer(wmsDataset(), 'gep-test-dataset')

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  test('does not cache failed capabilities responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      text: vi.fn().mockResolvedValue('Service unavailable')
    }))

    const failed = await createWmsLayer(wmsDataset(), 'gep-test-dataset')
    expect(failed).toBeNull()

    stubGetCapabilities(['retry_layer'])
    const layer = await createWmsLayer(wmsDataset(), 'gep-test-dataset')

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(layer).not.toBeNull()
  })
})

describe('#getSourceUrl', () => {
  test('prefers the first of getUrls and falls back to getUrl', () => {
    expect(getSourceUrl({ getUrls: () => ['https://a.example/wms'] })).toBe('https://a.example/wms')
    expect(getSourceUrl({ getUrl: () => 'https://b.example/wms' })).toBe('https://b.example/wms')
  })
})

describe('#getVisibleWmsLayers', () => {
  function mapWithLayers (layers) {
    return { getLayers: () => ({ getArray: () => layers }) }
  }

  function wmsLayer ({ wms = true, visible = true, layerNames = 'layer1', url = 'https://example.com/wms' } = {}) {
    return {
      get: (key) => (key === 'wms' ? wms : undefined),
      getVisible: () => visible,
      getSource: () => ({
        getParams: () => (layerNames ? { LAYERS: layerNames } : {}),
        getUrls: () => (url ? [url] : [])
      })
    }
  }

  test('keeps only visible WMS layers with layer names and a source URL', () => {
    const queryable = wmsLayer()
    const map = mapWithLayers([
      queryable,
      wmsLayer({ wms: false }),
      wmsLayer({ visible: false }),
      wmsLayer({ layerNames: '' }),
      wmsLayer({ url: '' })
    ])

    expect(getVisibleWmsLayers(map)).toEqual([queryable])
  })
})
