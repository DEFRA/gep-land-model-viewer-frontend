// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('@defra/interactive-map', () => ({
  EVENTS: {
    MAP_CLICK: 'map:click',
    MAP_STYLE_CHANGE: 'map:stylechange',
    APP_PANEL_OPENED: 'app:panelopened',
    APP_PANEL_CLOSED: 'app:panelclosed'
  }
}))

vi.mock('../../config/datasets.js', () => ({
  datasets: [
    {
      id: 'test-dataset',
      label: 'Test Dataset',
      source: {
        type: 'wms',
        url: 'https://example.com/wms',
        opacity: 0.7,
        attribution: 'Test Attribution'
      }
    },
    {
      id: 'dataset-with-layers',
      label: 'Dataset With Layers',
      source: {
        type: 'wms',
        url: 'https://example.com/wms2',
        layers: ['layer1', 'layer2'],
        attribution: 'Test Attribution'
      }
    },
    {
      id: 'test-cog',
      label: 'Test COG',
      source: {
        type: 'cog',
        url: '/land-model/raster/test.tif',
        opacity: 0.8,
        normalize: false,
        interpolate: false,
        style: { color: ['band', 1] }
      }
    },
    {
      id: 'test-fgb',
      label: 'Test FlatGeobuf',
      source: {
        type: 'fgb',
        url: '/land-model/vector/test.fgb',
        opacity: 0.7,
        styleUrl: '/land-model/vector/test.lyrx'
      }
    },
    {
      id: 'test-fgb-inline',
      label: 'Test FlatGeobuf without a layer file',
      source: {
        type: 'fgb',
        url: '/land-model/vector/inline.fgb',
        opacity: 0.7,
        minZoom: 7,
        style: { 'fill-color': 'rgba(178, 102, 204, 0.42)' }
      }
    },
    {
      id: 'test-fgb-min-zoom',
      label: 'Test FlatGeobuf with a configured minZoom and a layer file',
      source: {
        type: 'fgb',
        url: '/land-model/vector/min-zoom.fgb',
        opacity: 0.7,
        styleUrl: '/land-model/vector/min-zoom.lyrx',
        minZoom: 7
      }
    },
    {
      id: 'test-fgb-uncapped',
      label: 'Test FlatGeobuf with no zoom cap at all',
      source: {
        type: 'fgb',
        url: '/land-model/vector/uncapped.fgb',
        opacity: 0.7,
        style: { 'fill-color': 'rgba(178, 102, 204, 0.42)' }
      }
    },
    {
      id: 'test-fgb-with-overview',
      label: 'Test FlatGeobuf with overview tiles',
      source: {
        type: 'fgb',
        url: '/land-model/vector/with-overview.fgb',
        opacity: 0.7,
        styleUrl: '/land-model/vector/with-overview.lyrx',
        overview: {
          type: 'pmtiles',
          url: '/land-model/tiles/with-overview.pmtiles',
          maxZoom: 4
        }
      }
    },
    {
      id: 'test-fgb-with-overview-inline',
      label: 'Test FlatGeobuf overview without a layer file',
      source: {
        type: 'fgb',
        url: '/land-model/vector/with-overview-inline.fgb',
        opacity: 0.7,
        style: { 'fill-color': 'rgba(178, 102, 204, 0.42)' },
        overview: {
          type: 'pmtiles',
          url: '/land-model/tiles/with-overview-inline.pmtiles',
          maxZoom: 4
        }
      }
    },
    {
      id: 'test-fgb-bad-overview',
      label: 'Test FlatGeobuf with an unsupported overview type',
      source: {
        type: 'fgb',
        url: '/land-model/vector/bad-overview.fgb',
        opacity: 0.7,
        style: { 'fill-color': 'rgba(178, 102, 204, 0.42)' },
        overview: {
          type: 'cog',
          url: '/land-model/tiles/bad-overview.tif',
          maxZoom: 4
        }
      }
    },
    {
      id: 'test-unknown',
      label: 'Unsupported source',
      source: { type: 'something-else', url: '/nowhere' }
    }
  ]
}))

vi.mock('./render.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    renderLayersPanelHtml: vi.fn(() => '<div id="layers-panel"></div>'),
    LAYERS_ICON_SVG: '<path d="test"/>'
  }
})

vi.mock('ol/layer/Image.js', () => ({
  default: vi.fn().mockImplementation(stubLayer)
}))

vi.mock('ol/source/ImageWMS.js', () => ({
  default: vi.fn().mockImplementation(function (opts) {
    this._opts = opts
    this.getParams = vi.fn(() => opts?.params || {})
    this.getUrl = vi.fn(() => opts?.url)
  })
}))

function stubLayer (opts) {
  const properties = opts?.properties || {}
  let visible = true
  this._opts = opts
  this.get = vi.fn((key) => properties[key])
  this.getVisible = vi.fn(() => visible)
  this.setVisible = vi.fn((next) => {
    visible = next
  })
  this.getSource = vi.fn(() => opts?.source)
  this.getOpacity = vi.fn(() => opts?.opacity ?? 1)
  this.getMaxResolution = vi.fn(() => opts?.maxResolution ?? Infinity)
  this.getMinZoom = vi.fn(() => opts?.minZoom ?? -Infinity)
}

vi.mock('ol/layer/WebGLTile.js', () => ({
  default: vi.fn().mockImplementation(stubLayer)
}))

vi.mock('ol/layer/WebGLVector.js', () => ({
  default: vi.fn().mockImplementation(stubLayer)
}))

vi.mock('ol/source/GeoTIFF.js', () => ({
  default: vi.fn().mockImplementation(function (opts) {
    this._opts = opts
  })
}))

vi.mock('ol/source/Vector.js', () => ({
  default: vi.fn().mockImplementation(function (opts) {
    this._opts = opts
    this.setLoader = vi.fn()
  })
}))

vi.mock('flatgeobuf/lib/mjs/ol.js', () => ({
  createLoader: vi.fn(() => 'fgb-loader')
}))

vi.mock('./lyrx-style.js', () => ({
  loadLyrxStyle: vi.fn(async () => ({
    style: { 'fill-color': ['match', ['get', 'A_pred'], 'Bog', '#c29ed7', 'rgba(0, 0, 0, 0)'] },
    maxResolution: 28.109
  }))
}))

vi.mock('./pmtiles-layer.js', () => ({
  createPmtilesLayer: vi.fn(async (url, layerId, options) => {
    const layer = {}
    stubLayer.call(layer, { properties: { id: layerId }, opacity: options.opacity })
    return layer
  })
}))

vi.mock('./zoom-warning.js', () => ({
  registerZoomWarning: vi.fn(() => ({ set: vi.fn() }))
}))

const { loadLyrxStyle } = await import('./lyrx-style.js')
const { registerZoomWarning } = await import('./zoom-warning.js')
const { registerLayersPanel } = await import('./index.js')
const { resetCapabilitiesCache } = await import('./wms-layer.js')
const { datasets } = await import('../../config/datasets.js')
const { renderLayersPanelHtml } = await import('./render.js')
const layersPanelHtml = (await vi.importActual('./render.js')).renderLayersPanelHtml(datasets)

function zoomWarningSet () {
  return registerZoomWarning.mock.results.at(-1).value.set
}

function makeCapabilitiesXml (layerNames) {
  const layers = layerNames.map(name =>
    `<Layer queryable="1"><Name>${name}</Name></Layer>`
  ).join('')
  return `<?xml version="1.0"?><WMS_Capabilities><Capability><Layer>${layers}</Layer></Capability></WMS_Capabilities>`
}

function stubGetCapabilities (layerNames = ['discovered_layer']) {
  const capabilitiesResponse = {
    ok: true,
    text: vi.fn().mockResolvedValue(makeCapabilitiesXml(layerNames))
  }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(capabilitiesResponse))
  return capabilitiesResponse
}

function stubGetCapabilitiesHttpError () {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    text: vi.fn().mockResolvedValue('Service unavailable')
  }))
}

function stubPendingGetCapabilities () {
  let resolveText
  const textPromise = new Promise((resolve) => {
    resolveText = resolve
  })
  const capabilitiesResponse = {
    ok: true,
    text: vi.fn(() => textPromise)
  }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(capabilitiesResponse))
  return {
    resolve: (layerNames = ['discovered_layer']) => resolveText(makeCapabilitiesXml(layerNames))
  }
}

function createLayerCheckbox (id = 'test-dataset', checked = true) {
  const item = document.createElement('div')
  item.dataset.appLayerItem = ''
  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.id = `layer-${id}`
  checkbox.checked = checked
  checkbox.dataset.appLayerId = id
  item.appendChild(checkbox)
  document.body.appendChild(item)
  return checkbox
}

function createMapHarness () {
  const handlers = {}
  return {
    id: 'land-map',
    addButton: vi.fn(),
    addPanel: vi.fn(),
    showPanel: vi.fn(),
    hidePanel: vi.fn(),
    toggleButtonState: vi.fn(),
    emit: vi.fn(),
    on: vi.fn((event, handler) => {
      const existingHandler = handlers[event]
      handlers[event] = existingHandler
        ? (...args) => {
            existingHandler(...args)
            handler(...args)
          }
        : handler
    }),
    _handlers: handlers
  }
}

function createOlMapMock () {
  const layers = []
  return {
    addOverlay: vi.fn(),
    on: vi.fn(),
    forEachFeatureAtPixel: vi.fn(),
    addLayer: vi.fn((layer) => { layers.push(layer) }),
    removeLayer: vi.fn((layer) => {
      const idx = layers.indexOf(layer)
      if (idx >= 0) {
        layers.splice(idx, 1)
      }
    }),
    getLayers: vi.fn(() => ({
      getArray: vi.fn(() => [...layers])
    })),
    getTargetElement: vi.fn(() => document.getElementById('map-container')),
    getPixelFromCoordinate: vi.fn(([x, y]) => [x - 418700, 385300 - y]),
    getView: vi.fn(() => ({
      calculateExtent: vi.fn(() => [418700, 385100, 418900, 385300]),
      getZoomForResolution: vi.fn(() => 9.2)
    })),
    getSize: vi.fn(() => [800, 600]),
    _layers: layers
  }
}

function createVisibleWmsLayer (overrides = {}) {
  const layerNames = overrides.layerNames ?? 'layer1'
  const url = overrides.url ?? 'https://example.com/wms'
  const id = overrides.id ?? 'gep-test-dataset'
  let visible = overrides.visible !== false
  const wms = overrides.wms !== false
  const hasLayers = overrides.hasLayers !== false
  const hasUrl = overrides.hasUrl !== false

  const source = {
    getParams: vi.fn(() => hasLayers ? { LAYERS: layerNames } : {}),
    getUrls: vi.fn(() => hasUrl ? [url] : [])
  }

  return {
    get: vi.fn((key) => {
      if (key === 'wms') {
        return wms
      }
      if (key === 'id') {
        return id
      }
      return undefined
    }),
    getVisible: vi.fn(() => visible),
    getSource: vi.fn(() => source),
    setVisible: vi.fn((next) => {
      visible = next
    }),
    getMaxResolution: vi.fn(() => Infinity),
    getMinZoom: vi.fn(() => -Infinity)
  }
}

describe('#registerLayersPanel', () => {
  let interactiveMap
  let olMap

  beforeEach(() => {
    document.body.innerHTML = '<div id="map-container"></div><div class="im-c-attributions"></div>'
    window.history.replaceState({}, '', '/')
    localStorage.clear()
    interactiveMap = createMapHarness()
    olMap = createOlMapMock()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    resetCapabilitiesCache()
    document.body.innerHTML = ''
  })

  test('adds layers button', () => {
    registerLayersPanel(interactiveMap, olMap)

    expect(interactiveMap.addButton).toHaveBeenCalledWith(
      'gep-layers',
      expect.objectContaining({
        id: 'gep-layers',
        label: 'Layers',
        panelId: 'gep-layers'
      })
    )
  })

  test('adds layers panel with rendered HTML', () => {
    registerLayersPanel(interactiveMap, olMap)

    expect(renderLayersPanelHtml).toHaveBeenCalledWith(datasets)
    expect(interactiveMap.addPanel).toHaveBeenCalledWith(
      'gep-layers',
      expect.objectContaining({
        id: 'gep-layers',
        label: 'Layers'
      })
    )
  })

  describe('layers button visibility', () => {
    test('hides button when panel opens', () => {
      registerLayersPanel(interactiveMap, olMap)

      const openHandler = interactiveMap._handlers['app:panelopened']
      openHandler({ panelId: 'gep-layers' })

      expect(interactiveMap.toggleButtonState).toHaveBeenCalledWith(
        'gep-layers',
        'hidden',
        true
      )
    })

    test('shows button when panel closes', () => {
      registerLayersPanel(interactiveMap, olMap)

      const closeHandler = interactiveMap._handlers['app:panelclosed']
      closeHandler({ panelId: 'gep-layers' })

      expect(interactiveMap.toggleButtonState).toHaveBeenCalledWith(
        'gep-layers',
        'hidden',
        false
      )
    })

    test('ignores other panels', () => {
      registerLayersPanel(interactiveMap, olMap)

      const openHandler = interactiveMap._handlers['app:panelopened']
      openHandler({ panelId: 'other-panel' })

      expect(interactiveMap.toggleButtonState).not.toHaveBeenCalledWith(
        'gep-layers',
        'hidden',
        expect.anything()
      )
    })
  })

  test('layer checkbox change fetches GetCapabilities and adds WMS layer', async () => {
    stubGetCapabilities(['test_layer'])
    registerLayersPanel(interactiveMap, olMap)

    const checkbox = createLayerCheckbox()

    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('GetCapabilities'))
      expect(olMap.addLayer).toHaveBeenCalled()
    })
  })

  test('layer checkbox is disabled and marked busy while GetCapabilities is pending', async () => {
    const capabilities = stubPendingGetCapabilities()
    registerLayersPanel(interactiveMap, olMap)

    const checkbox = createLayerCheckbox()
    const item = checkbox.closest('[data-app-layer-item]')

    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    expect(checkbox.disabled).toBe(true)
    expect(item.getAttribute('aria-busy')).toBe('true')

    capabilities.resolve(['test_layer'])

    await vi.waitFor(() => {
      expect(checkbox.disabled).toBe(false)
      expect(item.hasAttribute('aria-busy')).toBe(false)
    })
  })

  test('updates existing interactive map attribution with visible WMS attributions', async () => {
    stubGetCapabilities(['test_layer'])
    registerLayersPanel(interactiveMap, olMap)

    const checkbox = createLayerCheckbox()

    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(document.querySelector('.im-c-attributions').textContent).toContain('Test Attribution')
    })
  })

  test('reapplies visible layer attribution after base map style changes', async () => {
    stubGetCapabilities(['test_layer'])
    registerLayersPanel(interactiveMap, olMap)

    const checkbox = createLayerCheckbox()

    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(document.querySelector('.im-c-attributions').textContent).toContain('Test Attribution')
    })

    document.querySelector('.im-c-attributions').textContent = 'Base attribution'
    interactiveMap._handlers['map:stylechange']({ mapStyleId: 'os-road' })

    expect(document.querySelector('.im-c-attributions').textContent).toContain('Test Attribution')
  })

  test('updates attribution without emitting a base map style change', async () => {
    stubGetCapabilities(['test_layer'])
    registerLayersPanel(interactiveMap, olMap)

    const checkbox = createLayerCheckbox()

    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(document.querySelector('.im-c-attributions').textContent).toContain('Test Attribution')
    })
    expect(interactiveMap.emit).not.toHaveBeenCalled()
  })

  test('resets checkbox, key and attribution when a layer update fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('failed')))
    registerLayersPanel(interactiveMap, olMap)
    document.body.innerHTML += '<div id="gep-key-content" class="app-map__key-panel"></div>'

    const checkbox = createLayerCheckbox()

    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(checkbox.disabled).toBe(false)
      expect(checkbox.checked).toBe(false)
      expect(document.getElementById('gep-key-content').textContent).toContain('Enable data layers to view the key.')
      expect(document.querySelector('.im-c-attributions').textContent).toContain('Crown copyright')
    })
  })

  test('a WMS service with no queryable layers clears the checkbox', async () => {
    stubGetCapabilitiesHttpError()
    registerLayersPanel(interactiveMap, olMap)

    const checkbox = createLayerCheckbox()
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(checkbox.disabled).toBe(false)
      expect(checkbox.checked).toBe(false)
      expect(olMap.addLayer).not.toHaveBeenCalled()
    })
  })

  test('layer checkbox change hides the layer when unchecked rather than removing it', async () => {
    vi.stubGlobal('fetch', vi.fn())
    registerLayersPanel(interactiveMap, olMap)

    const mockLayer = createVisibleWmsLayer({ id: 'gep-test-dataset' })
    olMap._layers.push(mockLayer)

    const checkbox = createLayerCheckbox('test-dataset', false)

    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(mockLayer.setVisible).toHaveBeenCalledWith(false)
    })
    expect(olMap.removeLayer).not.toHaveBeenCalled()
  })

  test('unchecking a layer that was never added builds nothing', async () => {
    vi.stubGlobal('fetch', vi.fn())
    registerLayersPanel(interactiveMap, olMap)

    const checkbox = createLayerCheckbox('test-fgb', false)
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(checkbox.disabled).toBe(false)
    })

    expect(loadLyrxStyle).not.toHaveBeenCalled()
    expect(olMap.addLayer).not.toHaveBeenCalled()
  })

  test('layer checkbox change adds a COG layer without any service requests', async () => {
    vi.stubGlobal('fetch', vi.fn())
    registerLayersPanel(interactiveMap, olMap)

    createLayerCheckbox('test-cog').dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(olMap.addLayer).toHaveBeenCalledTimes(1)
    })

    expect(global.fetch).not.toHaveBeenCalled()
    expect(olMap._layers[0].get('id')).toBe('gep-test-cog')
  })

  test('layer checkbox change adds a FlatGeobuf layer styled from its layer file', async () => {
    vi.stubGlobal('fetch', vi.fn())
    registerLayersPanel(interactiveMap, olMap)

    createLayerCheckbox('test-fgb').dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(olMap.addLayer).toHaveBeenCalledTimes(1)
    })

    expect(loadLyrxStyle).toHaveBeenCalledWith('/land-model/vector/test.lyrx', { lowercaseFields: false })
    expect(olMap._layers[0].get('id')).toBe('gep-test-fgb')
  })

  test('a dataset with an overview adds both of its layers', async () => {
    vi.stubGlobal('fetch', vi.fn())
    registerLayersPanel(interactiveMap, olMap)

    createLayerCheckbox('test-fgb-with-overview').dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(olMap.addLayer).toHaveBeenCalledTimes(2)
    })

    expect(olMap._layers.map(layer => layer.get('id'))).toEqual([
      'gep-test-fgb-with-overview',
      'gep-test-fgb-with-overview-overview'
    ])
  })

  test('unchecking a dataset with an overview hides both of its layers', async () => {
    vi.stubGlobal('fetch', vi.fn())
    registerLayersPanel(interactiveMap, olMap)

    const checkbox = createLayerCheckbox('test-fgb-with-overview')
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(olMap.addLayer).toHaveBeenCalledTimes(2)
    })

    checkbox.checked = false
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      for (const layer of olMap._layers) {
        expect(layer.setVisible).toHaveBeenCalledWith(false)
      }
    })
    expect(olMap.removeLayer).not.toHaveBeenCalled()
    expect(olMap.addLayer).toHaveBeenCalledTimes(2)
  })

  test('an unsupported overview type is logged and clears the checkbox', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    registerLayersPanel(interactiveMap, olMap)

    const checkbox = createLayerCheckbox('test-fgb-bad-overview')
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalled()
    })

    expect(consoleError).toHaveBeenCalledWith(
      'Failed to load data layer test-fgb-bad-overview',
      expect.objectContaining({
        message: 'Dataset test-fgb-bad-overview has unsupported overview type "cog", only pmtiles is supported'
      })
    )
    expect(olMap.addLayer).not.toHaveBeenCalled()
    expect(checkbox.checked).toBe(false)

    consoleError.mockRestore()
  })

  test('a layer file that cannot be read is logged and clears the checkbox', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    loadLyrxStyle.mockRejectedValueOnce(new Error('lyrx unreachable'))
    registerLayersPanel(interactiveMap, olMap)

    const checkbox = createLayerCheckbox('test-fgb')
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalled()
    })

    expect(consoleError).toHaveBeenCalledWith(
      'Failed to load data layer test-fgb',
      expect.objectContaining({ message: 'lyrx unreachable' })
    )
    expect(olMap.addLayer).not.toHaveBeenCalled()
    expect(checkbox.checked).toBe(false)

    consoleError.mockRestore()
  })

  test('layer checkbox change ignores an unsupported source type', async () => {
    vi.stubGlobal('fetch', vi.fn())
    registerLayersPanel(interactiveMap, olMap)

    createLayerCheckbox('test-unknown').dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(document.getElementById('layer-test-unknown').disabled).toBe(false)
    })

    expect(olMap.addLayer).not.toHaveBeenCalled()
  })

  test('search form submit filters layers', () => {
    registerLayersPanel(interactiveMap, olMap)

    document.body.innerHTML += layersPanelHtml

    const searchInput = document.querySelector('[data-app-layer-search]')
    searchInput.value = 'test'
    const form = document.querySelector('[data-app-layer-search-form]')
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    expect(document.querySelector('[data-label="test dataset"]').hidden).toBe(false)
    expect(document.querySelector('[data-label="dataset with layers"]').hidden).toBe(true)
  })

  test('search shows empty message when no items match', () => {
    registerLayersPanel(interactiveMap, olMap)

    document.body.innerHTML += layersPanelHtml

    const searchInput = document.querySelector('[data-app-layer-search]')
    searchInput.value = 'xyz-no-match'
    const form = document.querySelector('[data-app-layer-search-form]')
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    expect(document.querySelector('[data-app-layer-item]').hidden).toBe(true)
    expect(document.querySelector('[data-app-layer-empty]').hidden).toBe(false)
  })

  test('typing in search input does not filter layers', () => {
    registerLayersPanel(interactiveMap, olMap)

    document.body.innerHTML += layersPanelHtml

    const searchInput = document.querySelector('[data-app-layer-search]')
    searchInput.value = 'xyz-no-match'
    searchInput.dispatchEvent(new Event('input', { bubbles: true }))

    expect(document.querySelector('[data-app-layer-item]').hidden).toBe(false)
    expect(document.querySelector('[data-app-layer-empty]').hidden).toBe(true)
  })

  test('clearing search input via browser X button resets layers', () => {
    registerLayersPanel(interactiveMap, olMap)

    document.body.innerHTML += layersPanelHtml

    const searchInput = document.querySelector('[data-app-layer-search]')
    searchInput.value = 'test'
    const form = document.querySelector('[data-app-layer-search-form]')
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    expect(document.querySelector('[data-label="dataset with layers"]').hidden).toBe(true)

    searchInput.value = ''
    searchInput.dispatchEvent(new Event('search', { bubbles: true }))

    expect(document.querySelector('[data-label="test dataset"]').hidden).toBe(false)
    expect(document.querySelector('[data-label="dataset with layers"]').hidden).toBe(false)
    expect(document.querySelector('[data-app-layer-empty]').hidden).toBe(true)
  })

  test('search form submit calls preventDefault', () => {
    registerLayersPanel(interactiveMap, olMap)

    document.body.innerHTML += layersPanelHtml

    const form = document.querySelector('[data-app-layer-search-form]')
    const event = new Event('submit', { bubbles: true, cancelable: true })
    form.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  test('re-enabling existing layer sets visible true instead of creating new', async () => {
    vi.stubGlobal('fetch', vi.fn())
    registerLayersPanel(interactiveMap, olMap)

    const mockLayer = createVisibleWmsLayer({ id: 'gep-test-dataset', visible: false })
    mockLayer.setVisible = vi.fn()
    olMap._layers.push(mockLayer)

    const checkbox = createLayerCheckbox()

    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(mockLayer.setVisible).toHaveBeenCalledWith(true)
      expect(olMap.addLayer).not.toHaveBeenCalled()
    })
  })

  test('change event on non-layer element is ignored', () => {
    registerLayersPanel(interactiveMap, olMap)

    const div = document.createElement('div')
    document.body.appendChild(div)
    div.dispatchEvent(new Event('change', { bubbles: true }))

    expect(olMap.addLayer).not.toHaveBeenCalled()
    expect(olMap.removeLayer).not.toHaveBeenCalled()
  })

  test('submit event on a non-search form is ignored', () => {
    registerLayersPanel(interactiveMap, olMap)

    document.body.innerHTML += layersPanelHtml

    const form = document.createElement('form')
    document.body.appendChild(form)
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    expect(document.querySelector('[data-app-layer-item]').hidden).toBe(false)
  })

  test('search event on a non-search element is ignored', () => {
    registerLayersPanel(interactiveMap, olMap)

    document.body.innerHTML += layersPanelHtml

    const input = document.createElement('input')
    input.type = 'search'
    document.body.appendChild(input)
    input.dispatchEvent(new Event('search', { bubbles: true }))

    expect(document.querySelector('[data-app-layer-item]').hidden).toBe(false)
  })

  describe('land summary toggles', () => {
    function createSummaryCheckbox (id, checked) {
      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.checked = checked
      checkbox.dataset.appSummaryId = id
      document.body.appendChild(checkbox)
      return checkbox
    }

    test('checking a summary toggle shows its controller and tracks the zoom warning', () => {
      const grid = { minZoom: 11, setVisible: vi.fn() }
      registerLayersPanel(interactiveMap, olMap, undefined, undefined, { grid })

      createSummaryCheckbox('grid', true).dispatchEvent(new Event('change', { bubbles: true }))

      expect(grid.setVisible).toHaveBeenCalledWith(true)
      expect(olMap.addLayer).not.toHaveBeenCalled()
      expect(zoomWarningSet()).toHaveBeenCalledWith('summary-grid', {
        label: 'Grid squares',
        minZoom: 11,
        enabled: true
      })
    })

    test('unchecking a summary toggle hides its controller', () => {
      const features = { minZoom: 10, setVisible: vi.fn() }
      registerLayersPanel(interactiveMap, olMap, undefined, undefined, { features })

      createSummaryCheckbox('features', false).dispatchEvent(new Event('change', { bubbles: true }))

      expect(features.setVisible).toHaveBeenCalledWith(false)
      expect(zoomWarningSet()).toHaveBeenCalledWith('summary-features', {
        label: 'OS features',
        minZoom: 10,
        enabled: false
      })
    })

    test('checking a summary toggle disables the others until it is unchecked', () => {
      const grid = { minZoom: 11, setVisible: vi.fn() }
      const features = { minZoom: 10, setVisible: vi.fn() }
      registerLayersPanel(interactiveMap, olMap, undefined, undefined, { grid, features })

      const gridBox = createSummaryCheckbox('grid', true)
      const featuresBox = createSummaryCheckbox('features', false)
      gridBox.dispatchEvent(new Event('change', { bubbles: true }))

      expect(featuresBox.disabled).toBe(true)
      expect(gridBox.disabled).toBe(false)

      gridBox.checked = false
      gridBox.dispatchEvent(new Event('change', { bubbles: true }))

      expect(featuresBox.disabled).toBe(false)
    })

    test('a summary toggle without a registered controller is ignored', () => {
      const grid = { minZoom: 11, setVisible: vi.fn() }
      registerLayersPanel(interactiveMap, olMap, undefined, undefined, { grid })

      createSummaryCheckbox('features', true).dispatchEvent(new Event('change', { bubbles: true }))

      expect(grid.setVisible).not.toHaveBeenCalled()
      expect(olMap.addLayer).not.toHaveBeenCalled()
      expect(zoomWarningSet()).not.toHaveBeenCalled()
    })
  })

  describe('zoom warnings for datasets', () => {
    test('a dataset with a zoom floor and no overview is tracked when toggled', async () => {
      vi.stubGlobal('fetch', vi.fn())
      registerLayersPanel(interactiveMap, olMap)

      createLayerCheckbox('test-fgb-inline').dispatchEvent(new Event('change', { bubbles: true }))

      await vi.waitFor(() => {
        expect(olMap.addLayer).toHaveBeenCalled()
      })

      expect(zoomWarningSet()).toHaveBeenCalledWith('test-fgb-inline', {
        label: 'Test FlatGeobuf without a layer file',
        minZoom: 7,
        enabled: true
      })
    })

    test('a dataset capped by its layer file is tracked with the derived floor', async () => {
      vi.stubGlobal('fetch', vi.fn())
      registerLayersPanel(interactiveMap, olMap)

      createLayerCheckbox('test-fgb').dispatchEvent(new Event('change', { bubbles: true }))

      await vi.waitFor(() => {
        expect(olMap.addLayer).toHaveBeenCalled()
      })

      expect(zoomWarningSet()).toHaveBeenCalledWith('test-fgb', {
        label: 'Test FlatGeobuf',
        minZoom: 9.2,
        enabled: true
      })
    })

    test('a dataset with an overview is never warned about', async () => {
      vi.stubGlobal('fetch', vi.fn())
      registerLayersPanel(interactiveMap, olMap)

      createLayerCheckbox('test-fgb-with-overview').dispatchEvent(new Event('change', { bubbles: true }))

      await vi.waitFor(() => {
        expect(olMap.addLayer).toHaveBeenCalledTimes(2)
      })

      expect(zoomWarningSet()).toHaveBeenCalledWith('test-fgb-with-overview', expect.objectContaining({
        enabled: false
      }))
    })

    test('a dataset that fails to load is tracked as disabled', async () => {
      vi.stubGlobal('fetch', vi.fn())
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      loadLyrxStyle.mockRejectedValueOnce(new Error('lyrx unreachable'))
      registerLayersPanel(interactiveMap, olMap)

      const checkbox = createLayerCheckbox('test-fgb-min-zoom')
      checkbox.dispatchEvent(new Event('change', { bubbles: true }))

      await vi.waitFor(() => {
        expect(consoleError).toHaveBeenCalled()
      })

      expect(zoomWarningSet()).toHaveBeenCalledWith('test-fgb-min-zoom', expect.objectContaining({
        enabled: false
      }))

      consoleError.mockRestore()
    })
  })

  test('toggling a dataset refreshes the info panel hits', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const infoPanel = { refreshHits: vi.fn() }
    registerLayersPanel(interactiveMap, olMap, undefined, infoPanel)

    createLayerCheckbox('test-cog').dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(infoPanel.refreshHits).toHaveBeenCalled()
    })
  })

  test('change event with unknown dataset ID is ignored', () => {
    registerLayersPanel(interactiveMap, olMap)

    const checkbox = createLayerCheckbox('nonexistent-dataset')

    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    expect(olMap.addLayer).not.toHaveBeenCalled()
  })

  test('adds key button', () => {
    registerLayersPanel(interactiveMap, olMap)

    expect(interactiveMap.addButton).toHaveBeenCalledWith(
      'gep-key',
      expect.objectContaining({
        id: 'gep-key',
        label: 'Key',
        panelId: 'gep-key'
      })
    )
  })

  test('adds key panel', () => {
    registerLayersPanel(interactiveMap, olMap)

    expect(interactiveMap.addPanel).toHaveBeenCalledWith(
      'gep-key',
      expect.objectContaining({
        id: 'gep-key',
        label: 'Key'
      })
    )
  })

  test('key panel shows legend images for visible layers', async () => {
    stubGetCapabilities(['discovered_layer'])
    registerLayersPanel(interactiveMap, olMap)

    document.body.innerHTML += '<div id="gep-key-content" class="app-map__key-panel"></div>'

    const checkbox = createLayerCheckbox()

    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      const keyContent = document.getElementById('gep-key-content')
      const img = keyContent.querySelector('.app-map__key-legend')
      expect(img).not.toBeNull()
      expect(img.src).toContain('GetLegendGraphic')
      expect(img.src).toContain('discovered_layer')
      expect(img.alt).toBe('Legend for discovered layer')

      const heading = keyContent.querySelector('.govuk-heading-xs')
      expect(heading.textContent).toBe('Test Dataset')
    })
  })

  test('key panel shows empty message when no layers visible', async () => {
    stubGetCapabilities(['discovered_layer'])
    registerLayersPanel(interactiveMap, olMap)

    document.body.innerHTML += '<div id="gep-key-content" class="app-map__key-panel"></div>'

    const checkbox = createLayerCheckbox()

    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(olMap.addLayer).toHaveBeenCalled()
    })

    vi.stubGlobal('fetch', vi.fn())
    checkbox.checked = false
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      const keyContent = document.getElementById('gep-key-content')
      expect(keyContent.querySelector('.app-map__key-legend')).toBeNull()
      expect(keyContent.textContent).toContain('Enable data layers to view the key.')
    })
  })
})
