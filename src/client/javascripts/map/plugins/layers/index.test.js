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
  default: vi.fn().mockImplementation(function (opts) {
    const properties = opts?.properties || {}
    this._opts = opts
    this.get = vi.fn((key) => properties[key])
    this.getVisible = vi.fn(() => true)
    this.setVisible = vi.fn()
    this.getSource = vi.fn(() => opts?.source)
    this.getOpacity = vi.fn(() => opts?.opacity ?? 1)
  })
}))

vi.mock('ol/source/ImageWMS.js', () => ({
  default: vi.fn().mockImplementation(function (opts) {
    this._opts = opts
    this.getParams = vi.fn(() => opts?.params || {})
    this.getUrl = vi.fn(() => opts?.url)
  })
}))

const { registerLayersPanel, resetCapabilitiesCache } = await import('./index.js')
const { datasets } = await import('../../config/datasets.js')
const { renderLayersPanelHtml } = await import('./render.js')

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
      calculateExtent: vi.fn(() => [418700, 385100, 418900, 385300])
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
    })
  }
}

function mockVisibleWmsLayers (olMap, layerSpecs = [{}]) {
  const wmsLayers = layerSpecs.map(createVisibleWmsLayer)
  olMap.getLayers.mockImplementation(() => ({
    getArray: vi.fn(() => [...wmsLayers])
  }))
  return wmsLayers
}

describe('#registerLayersPanel', () => {
  let interactiveMap
  let olMap

  beforeEach(() => {
    document.body.innerHTML = '<div id="map-container"></div><div class="im-c-attributions"></div><div id="gep-layer-info-status" role="status" aria-live="polite" aria-atomic="true"></div><div id="gep-layer-info-content"></div>'
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

  test('adds identify button', () => {
    registerLayersPanel(interactiveMap, olMap)

    expect(interactiveMap.addButton).toHaveBeenCalledWith(
      'gep-layer-info-toggle',
      expect.objectContaining({
        id: 'gep-layer-info-toggle',
        label: 'Identify',
        isPressed: false
      })
    )
  })

  test('adds feature info panel', () => {
    registerLayersPanel(interactiveMap, olMap)

    expect(interactiveMap.addPanel).toHaveBeenCalledWith(
      'gep-layer-info',
      expect.objectContaining({
        id: 'gep-layer-info',
        label: 'Data Layer Attributes',
        html: expect.stringContaining('id="gep-layer-info-status"'),
        mobile: expect.objectContaining({ modal: true }),
        tablet: expect.objectContaining({ slot: 'middle', modal: true }),
        desktop: expect.objectContaining({ slot: 'middle', modal: true })
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

  test('identify button toggles info mode', () => {
    registerLayersPanel(interactiveMap, olMap)

    const buttonConfig = interactiveMap.addButton.mock.calls.find(
      call => call[0] === 'gep-layer-info-toggle'
    )[1]

    buttonConfig.onClick()

    expect(interactiveMap.toggleButtonState).toHaveBeenCalledWith(
      'gep-layer-info-toggle',
      'pressed',
      true
    )
    expect(document.getElementById('map-container').classList.contains('app-map--identify')).toBe(true)

    buttonConfig.onClick()

    expect(interactiveMap.toggleButtonState).toHaveBeenCalledWith(
      'gep-layer-info-toggle',
      'pressed',
      false
    )
    expect(interactiveMap.hidePanel).toHaveBeenCalledWith('gep-layer-info')
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

  test('passes dataset attribution to WMS source', async () => {
    stubGetCapabilities(['test_layer'])
    registerLayersPanel(interactiveMap, olMap)

    const { default: ImageWMS } = await import('ol/source/ImageWMS.js')
    const checkbox = createLayerCheckbox()

    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(ImageWMS).toHaveBeenCalledWith(
        expect.objectContaining({
          attributions: 'Test Attribution',
          ratio: 1.5
        })
      )
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

  test('does not cache failed capabilities responses', async () => {
    stubGetCapabilitiesHttpError()
    registerLayersPanel(interactiveMap, olMap)

    const checkbox = createLayerCheckbox()
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(checkbox.disabled).toBe(false)
      expect(checkbox.checked).toBe(false)
      expect(olMap.addLayer).not.toHaveBeenCalled()
    })

    const fetchCallsAfterFailure = global.fetch.mock.calls.length
    global.fetch.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(makeCapabilitiesXml(['retry_layer']))
    })
    checkbox.checked = true
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(global.fetch.mock.calls.length).toBeGreaterThan(fetchCallsAfterFailure)
      expect(olMap.addLayer).toHaveBeenCalled()
    })
  })

  test('layer checkbox change removes WMS layer when unchecked', async () => {
    vi.stubGlobal('fetch', vi.fn())
    registerLayersPanel(interactiveMap, olMap)

    const mockLayer = createVisibleWmsLayer({ id: 'gep-test-dataset' })
    olMap._layers.push(mockLayer)

    const checkbox = createLayerCheckbox('test-dataset', false)

    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(olMap.removeLayer).toHaveBeenCalledWith(mockLayer)
    })
  })

  test('search input filters layers', () => {
    registerLayersPanel(interactiveMap, olMap)

    document.body.innerHTML += `
      <input data-app-layer-search value="test">
      <div data-app-layer-item data-label="test dataset"></div>
      <div data-app-layer-item data-label="other"></div>
      <div data-app-layer-empty hidden></div>
    `

    const searchInput = document.querySelector('[data-app-layer-search]')
    searchInput.dispatchEvent(new Event('input', { bubbles: true }))

    const testItem = document.querySelector('[data-label="test dataset"]')
    const otherItem = document.querySelector('[data-label="other"]')

    expect(testItem.hidden).toBe(false)
    expect(otherItem.hidden).toBe(true)
  })

  test('map click with identify mode queries WMS layers', async () => {
    vi.useFakeTimers()
    mockVisibleWmsLayers(olMap)

    registerLayersPanel(interactiveMap, olMap)

    const buttonConfig = interactiveMap.addButton.mock.calls.find(
      call => call[0] === 'gep-layer-info-toggle'
    )[1]
    buttonConfig.onClick()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        features: [{ properties: { name: 'Test Feature' } }]
      })
    }))

    interactiveMap._handlers['map:click']({ coords: [418750, 385150] })
    await vi.advanceTimersByTimeAsync(300)

    expect(global.fetch).toHaveBeenCalled()
    expect(document.getElementById('gep-layer-info-content').hasAttribute('aria-busy')).toBe(false)
    expect(document.getElementById('gep-layer-info-status').textContent).toBe('Attributes loaded')
    expect(interactiveMap.showPanel).toHaveBeenCalledWith('gep-layer-info')
  })

  test('shows loading state while feature info is being requested', async () => {
    vi.useFakeTimers()
    mockVisibleWmsLayers(olMap)

    registerLayersPanel(interactiveMap, olMap)

    const buttonConfig = interactiveMap.addButton.mock.calls.find(
      call => call[0] === 'gep-layer-info-toggle'
    )[1]
    buttonConfig.onClick()

    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

    interactiveMap._handlers['map:click']({ coords: [418750, 385150] })
    await vi.advanceTimersByTimeAsync(300)

    const contentEl = document.getElementById('gep-layer-info-content')
    expect(interactiveMap.showPanel).toHaveBeenCalledWith('gep-layer-info')
    expect(contentEl.getAttribute('aria-busy')).toBe('true')
    expect(contentEl.textContent).toContain('Loading data layer attributes...')
    expect(contentEl.querySelector('[role="status"]')).toBeNull()
    expect(document.getElementById('gep-layer-info-status').textContent).toBe('Loading attributes')
  })

  test('does not start another identify request while one is loading', async () => {
    vi.useFakeTimers()
    mockVisibleWmsLayers(olMap)

    registerLayersPanel(interactiveMap, olMap)

    const buttonConfig = interactiveMap.addButton.mock.calls.find(
      call => call[0] === 'gep-layer-info-toggle'
    )[1]
    buttonConfig.onClick()

    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

    interactiveMap._handlers['map:click']({ coords: [418750, 385150] })
    await vi.advanceTimersByTimeAsync(300)
    interactiveMap._handlers['map:click']({ coords: [418760, 385160] })
    await vi.advanceTimersByTimeAsync(300)

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  test('second click before identify starts cancels the pending request', async () => {
    vi.useFakeTimers()
    registerLayersPanel(interactiveMap, olMap)

    const buttonConfig = interactiveMap.addButton.mock.calls.find(
      call => call[0] === 'gep-layer-info-toggle'
    )[1]
    buttonConfig.onClick()

    vi.stubGlobal('fetch', vi.fn())

    interactiveMap._handlers['map:click']({ coords: [418750, 385150] })
    interactiveMap._handlers['map:click']({ coords: [418750, 385150] })
    await vi.advanceTimersByTimeAsync(300)

    expect(global.fetch).not.toHaveBeenCalled()
    expect(interactiveMap.showPanel).not.toHaveBeenCalledWith('gep-layer-info')
  })

  test('closing the identify panel aborts the active request', async () => {
    vi.useFakeTimers()
    mockVisibleWmsLayers(olMap)

    registerLayersPanel(interactiveMap, olMap)

    const buttonConfig = interactiveMap.addButton.mock.calls.find(
      call => call[0] === 'gep-layer-info-toggle'
    )[1]
    buttonConfig.onClick()

    let requestSignal
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      requestSignal = options.signal
      return new Promise(() => {})
    }))

    interactiveMap._handlers['map:click']({ coords: [418750, 385150] })
    await vi.advanceTimersByTimeAsync(300)
    interactiveMap._handlers['app:panelclosed']({ panelId: 'gep-layer-info' })

    expect(requestSignal.aborted).toBe(true)
  })

  test('does not render an error for cancelled feature info requests', async () => {
    vi.useFakeTimers()
    mockVisibleWmsLayers(olMap)

    registerLayersPanel(interactiveMap, olMap)

    const buttonConfig = interactiveMap.addButton.mock.calls.find(
      call => call[0] === 'gep-layer-info-toggle'
    )[1]
    buttonConfig.onClick()

    let rejectRequest
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve, reject) => {
      rejectRequest = reject
    })))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    interactiveMap._handlers['map:click']({ coords: [418750, 385150] })
    await vi.advanceTimersByTimeAsync(300)
    interactiveMap._handlers['app:panelclosed']({ panelId: 'gep-layer-info' })

    const abortError = new Error('Cancelled')
    abortError.name = 'AbortError'
    rejectRequest(abortError)
    await vi.advanceTimersByTimeAsync(0)

    expect(consoleSpy).not.toHaveBeenCalled()
    expect(document.getElementById('gep-layer-info-content').textContent).not.toContain('Data layer attributes could not be loaded.')
    consoleSpy.mockRestore()
  })

  test('feature properties from WMS are rendered as text, not HTML', async () => {
    vi.useFakeTimers()
    mockVisibleWmsLayers(olMap)

    registerLayersPanel(interactiveMap, olMap)

    const buttonConfig = interactiveMap.addButton.mock.calls.find(
      call => call[0] === 'gep-layer-info-toggle'
    )[1]
    buttonConfig.onClick()

    const injection = '<img src=x onerror="window.__xss=1">'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        features: [
          { properties: { 'name<script>': injection, empty: '', missing: null } },
          { properties: { second: 'feature' } }
        ]
      })
    }))

    interactiveMap._handlers['map:click']({ coords: [418750, 385150] })
    await vi.advanceTimersByTimeAsync(300)

    const contentEl = document.getElementById('gep-layer-info-content')
    expect(contentEl.querySelector('.app-map__layer-info')).not.toBeNull()
    expect(contentEl.querySelectorAll('.app-map__layer-info-section')).toHaveLength(2)
    expect(contentEl.querySelectorAll('.app-map__layer-info-list')).toHaveLength(2)
    expect(contentEl.querySelector('img')).toBeNull()
    expect(contentEl.querySelector('script')).toBeNull()
    expect(contentEl.textContent).toContain('name<script>')
    expect(contentEl.textContent).toContain(injection)
    expect(contentEl.textContent).not.toContain('empty')
    expect(contentEl.textContent).not.toContain('missing')
    expect(window.__xss).toBeUndefined()
  })

  test('renders each identified layer feature as a repeated title and attributes table', async () => {
    vi.useFakeTimers()
    mockVisibleWmsLayers(olMap, [
      { id: 'gep-test-dataset' },
      { id: 'gep-unknown', layerNames: 'layer2', url: 'https://example.com/wms2' }
    ])

    registerLayersPanel(interactiveMap, olMap)

    const buttonConfig = interactiveMap.addButton.mock.calls.find(
      call => call[0] === 'gep-layer-info-toggle'
    )[1]
    buttonConfig.onClick()

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          features: [
            { properties: { 'Object ID': '31840', 'Woodland name': 'Green Lane Spring' } },
            { properties: { 'Object ID': '31841', 'Woodland name': 'Second Wood' } }
          ]
        })
      })
      .mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          features: [
            { properties: { Status: 'Active' } }
          ]
        })
      }))

    interactiveMap._handlers['map:click']({ coords: [418750, 385150] })
    await vi.advanceTimersByTimeAsync(300)

    const sections = document.querySelectorAll('.app-map__layer-info-section')
    expect(sections).toHaveLength(3)
    expect(sections[0].querySelector('.app-map__layer-info-heading').textContent).toBe('Test Dataset')
    expect(sections[0].textContent).toContain('Object ID')
    expect(sections[0].textContent).toContain('31840')
    expect(sections[1].querySelector('.app-map__layer-info-heading').textContent).toBe('Test Dataset')
    expect(sections[1].textContent).toContain('Second Wood')
    expect(sections[2].querySelector('.app-map__layer-info-heading').textContent).toBe('Unknown Layer')
    expect(sections[2].textContent).toContain('Active')
  })

  test('map click without identify mode does nothing', async () => {
    registerLayersPanel(interactiveMap, olMap)

    vi.stubGlobal('fetch', vi.fn())

    const clickHandler = interactiveMap._handlers['map:click']
    await clickHandler({ coords: [418750, 385150] })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('map click with identify mode but no WMS layers does nothing', async () => {
    vi.useFakeTimers()
    registerLayersPanel(interactiveMap, olMap)

    const buttonConfig = interactiveMap.addButton.mock.calls.find(
      call => call[0] === 'gep-layer-info-toggle'
    )[1]
    buttonConfig.onClick()

    vi.stubGlobal('fetch', vi.fn())

    interactiveMap._handlers['map:click']({ coords: [418750, 385150] })
    await vi.advanceTimersByTimeAsync(300)

    expect(global.fetch).not.toHaveBeenCalled()
    expect(document.getElementById('gep-layer-info-content').textContent).toContain('No data layer attributes found at this location.')
  })

  test('ignores layers that are not queryable WMS layers', async () => {
    vi.useFakeTimers()
    mockVisibleWmsLayers(olMap, [
      { wms: false },
      { hasUrl: false },
      { hasLayers: false },
      { visible: false }
    ])

    registerLayersPanel(interactiveMap, olMap)

    const buttonConfig = interactiveMap.addButton.mock.calls.find(
      call => call[0] === 'gep-layer-info-toggle'
    )[1]
    buttonConfig.onClick()

    vi.stubGlobal('fetch', vi.fn())

    interactiveMap._handlers['map:click']({ coords: [418750, 385150] })
    await vi.advanceTimersByTimeAsync(300)

    expect(global.fetch).not.toHaveBeenCalled()
    expect(document.getElementById('gep-layer-info-content').textContent).toContain('No data layer attributes found at this location.')
  })

  test('search shows empty message when no items match', () => {
    registerLayersPanel(interactiveMap, olMap)

    document.body.innerHTML += `
      <input data-app-layer-search value="xyz-no-match">
      <div data-app-layer-item data-label="flood zones"></div>
      <div data-app-layer-empty hidden></div>
    `

    const searchInput = document.querySelector('[data-app-layer-search]')
    searchInput.dispatchEvent(new Event('input', { bubbles: true }))

    expect(document.querySelector('[data-app-layer-item]').hidden).toBe(true)
    expect(document.querySelector('[data-app-layer-empty]').hidden).toBe(false)
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

  test('skips GetCapabilities when dataset has explicit layers', async () => {
    vi.stubGlobal('fetch', vi.fn())
    registerLayersPanel(interactiveMap, olMap)

    const { default: ImageWMS } = await import('ol/source/ImageWMS.js')

    const checkbox = createLayerCheckbox('dataset-with-layers')

    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(global.fetch).not.toHaveBeenCalled()
      expect(ImageWMS).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            LAYERS: 'layer1,layer2'
          })
        })
      )
    })
  })

  test('GetFeatureInfo shows a generic message when fetch errors', async () => {
    vi.useFakeTimers()
    mockVisibleWmsLayers(olMap)

    registerLayersPanel(interactiveMap, olMap)

    const buttonConfig = interactiveMap.addButton.mock.calls.find(
      call => call[0] === 'gep-layer-info-toggle'
    )[1]
    buttonConfig.onClick()

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    interactiveMap._handlers['map:click']({ coords: [418750, 385150] })
    await vi.advanceTimersByTimeAsync(300)

    const contentEl = document.getElementById('gep-layer-info-content')
    expect(consoleSpy).not.toHaveBeenCalled()
    expect(contentEl.textContent).toContain('Data layer attributes could not be loaded.')
    expect(contentEl.textContent).not.toContain('No data layer attributes found at this location.')
    expect(document.getElementById('gep-layer-info-status').textContent).toBe('Some attributes could not be loaded')
    consoleSpy.mockRestore()
  })

  test('shows no data when WMS layer has empty LAYERS param', async () => {
    vi.useFakeTimers()
    mockVisibleWmsLayers(olMap, [{ hasLayers: false }])

    registerLayersPanel(interactiveMap, olMap)

    const buttonConfig = interactiveMap.addButton.mock.calls.find(
      call => call[0] === 'gep-layer-info-toggle'
    )[1]
    buttonConfig.onClick()

    vi.stubGlobal('fetch', vi.fn())

    interactiveMap._handlers['map:click']({ coords: [418750, 385150] })
    await vi.advanceTimersByTimeAsync(300)

    expect(global.fetch).not.toHaveBeenCalled()
    expect(document.getElementById('gep-layer-info-content').textContent).toContain('No data layer attributes found at this location.')
  })

  test('shows no features message when query returns empty', async () => {
    vi.useFakeTimers()
    mockVisibleWmsLayers(olMap)

    registerLayersPanel(interactiveMap, olMap)

    const buttonConfig = interactiveMap.addButton.mock.calls.find(
      call => call[0] === 'gep-layer-info-toggle'
    )[1]
    buttonConfig.onClick()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ features: [] })
    }))

    interactiveMap._handlers['map:click']({ coords: [418750, 385150] })
    await vi.advanceTimersByTimeAsync(300)

    const contentEl = document.getElementById('gep-layer-info-content')
    expect(interactiveMap.showPanel).toHaveBeenCalledWith('gep-layer-info')
    expect(contentEl.hasAttribute('aria-busy')).toBe(false)
    expect(contentEl.textContent).toContain('No data layer attributes found at this location.')
    expect(contentEl.querySelector('[role="status"]')).toBeNull()
    expect(document.getElementById('gep-layer-info-status').textContent).toBe('No attributes found')
  })

  test('change event on non-layer element is ignored', () => {
    registerLayersPanel(interactiveMap, olMap)

    const div = document.createElement('div')
    document.body.appendChild(div)
    div.dispatchEvent(new Event('change', { bubbles: true }))

    expect(olMap.addLayer).not.toHaveBeenCalled()
    expect(olMap.removeLayer).not.toHaveBeenCalled()
  })

  test('change event with unknown dataset ID is ignored', () => {
    registerLayersPanel(interactiveMap, olMap)

    const checkbox = createLayerCheckbox('nonexistent-dataset')

    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    expect(olMap.addLayer).not.toHaveBeenCalled()
  })

  test('disabling identify mode cancels a pending double-click guard', async () => {
    vi.useFakeTimers()
    mockVisibleWmsLayers(olMap)
    registerLayersPanel(interactiveMap, olMap)

    const buttonConfig = interactiveMap.addButton.mock.calls.find(
      call => call[0] === 'gep-layer-info-toggle'
    )[1]
    buttonConfig.onClick()

    vi.stubGlobal('fetch', vi.fn())

    interactiveMap._handlers['map:click']({ coords: [418750, 385150] })

    buttonConfig.onClick()
    await vi.advanceTimersByTimeAsync(300)

    expect(global.fetch).not.toHaveBeenCalled()
    expect(interactiveMap.showPanel).not.toHaveBeenCalledWith('gep-layer-info')
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
