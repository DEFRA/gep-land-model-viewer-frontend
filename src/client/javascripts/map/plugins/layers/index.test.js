// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('@defra/interactive-map', () => ({
  EVENTS: {
    MAP_CLICK: 'map:click',
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
      id: 'dataset-with-sublayers',
      label: 'Dataset With Sublayers',
      source: {
        type: 'wms',
        url: 'https://example.com/wms2',
        layers: ['layer1', 'layer2'],
        attribution: 'Test Attribution'
      }
    }
  ]
}))

vi.mock('./render.js', () => ({
  renderLayersPanelHtml: vi.fn(() => '<div id="layers-panel"></div>'),
  LAYERS_ICON_SVG: '<path d="test"/>'
}))

vi.mock('@arcgis/core/layers/WMSLayer.js', () => ({
  default: vi.fn().mockImplementation(function (opts) {
    this.id = opts?.id
    this.url = opts?.url
    this.visible = true
    this.type = 'wms'
    this.sublayers = {
      filter: vi.fn(() => ({
        map: vi.fn(() => ({
          toArray: vi.fn(() => ['sublayer1'])
        }))
      }))
    }
    this.load = vi.fn().mockResolvedValue(this)
    this.version = '1.3.0'
  })
}))

vi.mock('@arcgis/core/geometry/Point.js', () => ({
  default: vi.fn().mockImplementation(function (opts) {
    this.x = opts?.x
    this.y = opts?.y
    this.spatialReference = opts?.spatialReference
  })
}))

const { registerLayersPanel } = await import('./index.js')
const { datasets } = await import('../../config/datasets.js')
const { renderLayersPanelHtml } = await import('./render.js')

function createMapHarness () {
  const handlers = {}
  return {
    addButton: vi.fn(),
    addPanel: vi.fn(),
    showPanel: vi.fn(),
    hidePanel: vi.fn(),
    toggleButtonState: vi.fn(),
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

function createArcgisMapMock () {
  const layers = []
  return {
    add: vi.fn((layer) => { layers.push(layer) }),
    remove: vi.fn((layer) => {
      const idx = layers.indexOf(layer)
      if (idx >= 0) {
        layers.splice(idx, 1)
      }
    }),
    findLayerById: vi.fn((id) => layers.find(l => l.id === id)),
    layers: {
      filter: vi.fn(() => ({
        length: 0,
        toArray: vi.fn(() => [])
      }))
    },
    _layers: layers
  }
}

function createViewMock () {
  return {
    container: document.getElementById('map-container'),
    extent: { xmin: 418700, ymin: 385100, xmax: 418900, ymax: 385300, width: 200, height: 200 },
    width: 800,
    height: 600,
    spatialReference: { wkid: 27700 },
    toScreen: vi.fn(point => ({ x: point.x - 418700, y: 385300 - point.y }))
  }
}

function createVisibleWmsLayer (overrides = {}) {
  return {
    type: 'wms',
    visible: true,
    url: 'https://example.com/wms',
    load: vi.fn().mockResolvedValue(),
    sublayers: {
      filter: vi.fn(() => ({
        map: vi.fn(() => ({ toArray: vi.fn(() => ['layer1']) }))
      }))
    },
    ...overrides
  }
}

function mockVisibleWmsLayers (arcgisMap, layers = [{}]) {
  const wmsLayers = layers.map(createVisibleWmsLayer)
  arcgisMap.layers.filter.mockImplementation((predicate) => {
    const filteredLayers = wmsLayers.filter(predicate)
    return {
      length: filteredLayers.length,
      toArray: vi.fn(() => filteredLayers)
    }
  })
  return wmsLayers
}

describe('#registerLayersPanel', () => {
  let interactiveMap
  let arcgisMap
  let view

  beforeEach(() => {
    document.body.innerHTML = '<div id="map-container"></div><div id="gep-layer-info-status" role="status" aria-live="polite" aria-atomic="true"></div><div id="gep-layer-info-content"></div>'
    interactiveMap = createMapHarness()
    arcgisMap = createArcgisMapMock()
    view = createViewMock()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  test('adds layers button', () => {
    registerLayersPanel(interactiveMap, arcgisMap, view)

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
    registerLayersPanel(interactiveMap, arcgisMap, view)

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
    registerLayersPanel(interactiveMap, arcgisMap, view)

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
    registerLayersPanel(interactiveMap, arcgisMap, view)

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
      registerLayersPanel(interactiveMap, arcgisMap, view)

      const openHandler = interactiveMap._handlers['app:panelopened']
      openHandler({ panelId: 'gep-layers' })

      expect(interactiveMap.toggleButtonState).toHaveBeenCalledWith(
        'gep-layers',
        'hidden',
        true
      )
    })

    test('shows button when panel closes', () => {
      registerLayersPanel(interactiveMap, arcgisMap, view)

      const closeHandler = interactiveMap._handlers['app:panelclosed']
      closeHandler({ panelId: 'gep-layers' })

      expect(interactiveMap.toggleButtonState).toHaveBeenCalledWith(
        'gep-layers',
        'hidden',
        false
      )
    })

    test('ignores other panels', () => {
      registerLayersPanel(interactiveMap, arcgisMap, view)

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
    registerLayersPanel(interactiveMap, arcgisMap, view)

    const buttonConfig = interactiveMap.addButton.mock.calls.find(
      call => call[0] === 'gep-layer-info-toggle'
    )[1]

    buttonConfig.onClick()

    expect(interactiveMap.toggleButtonState).toHaveBeenCalledWith(
      'gep-layer-info-toggle',
      'pressed',
      true
    )
    expect(view.container.classList.contains('app-map--identify')).toBe(true)

    buttonConfig.onClick()

    expect(interactiveMap.toggleButtonState).toHaveBeenCalledWith(
      'gep-layer-info-toggle',
      'pressed',
      false
    )
    expect(interactiveMap.hidePanel).toHaveBeenCalledWith('gep-layer-info')
  })

  test('layer checkbox change adds WMS layer when checked', async () => {
    registerLayersPanel(interactiveMap, arcgisMap, view)

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = true
    checkbox.dataset.appLayerId = 'test-dataset'
    document.body.appendChild(checkbox)

    const event = new Event('change', { bubbles: true })
    checkbox.dispatchEvent(event)

    await vi.waitFor(() => {
      expect(arcgisMap.add).toHaveBeenCalled()
    })
  })

  test('layer checkbox change removes WMS layer when unchecked', async () => {
    registerLayersPanel(interactiveMap, arcgisMap, view)

    const { default: WMSLayer } = await import('@arcgis/core/layers/WMSLayer.js')
    const mockLayer = new WMSLayer({ id: 'gep-test-dataset' })
    arcgisMap._layers.push(mockLayer)
    arcgisMap.findLayerById.mockReturnValue(mockLayer)

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = false
    checkbox.dataset.appLayerId = 'test-dataset'
    document.body.appendChild(checkbox)

    const event = new Event('change', { bubbles: true })
    checkbox.dispatchEvent(event)

    await vi.waitFor(() => {
      expect(arcgisMap.remove).toHaveBeenCalledWith(mockLayer)
    })
  })

  test('search input filters layers', () => {
    registerLayersPanel(interactiveMap, arcgisMap, view)

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
    mockVisibleWmsLayers(arcgisMap)

    registerLayersPanel(interactiveMap, arcgisMap, view)

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
    mockVisibleWmsLayers(arcgisMap)

    registerLayersPanel(interactiveMap, arcgisMap, view)

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
    mockVisibleWmsLayers(arcgisMap)

    registerLayersPanel(interactiveMap, arcgisMap, view)

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
    registerLayersPanel(interactiveMap, arcgisMap, view)

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
    mockVisibleWmsLayers(arcgisMap)

    registerLayersPanel(interactiveMap, arcgisMap, view)

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

  test('closing the identify panel before the layer loads prevents the fetch', async () => {
    vi.useFakeTimers()
    let resolveLoad
    mockVisibleWmsLayers(arcgisMap, [{
      load: vi.fn(() => new Promise(resolve => { resolveLoad = resolve }))
    }])

    registerLayersPanel(interactiveMap, arcgisMap, view)

    const buttonConfig = interactiveMap.addButton.mock.calls.find(
      call => call[0] === 'gep-layer-info-toggle'
    )[1]
    buttonConfig.onClick()

    vi.stubGlobal('fetch', vi.fn())

    interactiveMap._handlers['map:click']({ coords: [418750, 385150] })
    await vi.advanceTimersByTimeAsync(300)
    interactiveMap._handlers['app:panelclosed']({ panelId: 'gep-layer-info' })
    resolveLoad()
    await vi.advanceTimersByTimeAsync(0)

    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('does not render an error for cancelled feature info requests', async () => {
    vi.useFakeTimers()
    mockVisibleWmsLayers(arcgisMap)

    registerLayersPanel(interactiveMap, arcgisMap, view)

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
    mockVisibleWmsLayers(arcgisMap)

    registerLayersPanel(interactiveMap, arcgisMap, view)

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
    mockVisibleWmsLayers(arcgisMap, [
      { id: 'gep-test-dataset' },
      {
        id: 'custom-layer',
        title: 'Custom Layer',
        url: 'https://example.com/wms2',
        sublayers: {
          filter: vi.fn(() => ({
            map: vi.fn(() => ({ toArray: vi.fn(() => ['layer2']) }))
          }))
        }
      }
    ])

    registerLayersPanel(interactiveMap, arcgisMap, view)

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
    expect(sections[2].querySelector('.app-map__layer-info-heading').textContent).toBe('Custom Layer')
    expect(sections[2].textContent).toContain('Active')
  })

  test('map click without identify mode does nothing', async () => {
    registerLayersPanel(interactiveMap, arcgisMap, view)

    vi.stubGlobal('fetch', vi.fn())

    const clickHandler = interactiveMap._handlers['map:click']
    await clickHandler({ coords: [418750, 385150] })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('map click with identify mode but no WMS layers does nothing', async () => {
    vi.useFakeTimers()
    registerLayersPanel(interactiveMap, arcgisMap, view)

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
    mockVisibleWmsLayers(arcgisMap, [
      { type: 'feature' },
      { url: undefined },
      { sublayers: null },
      { visible: false }
    ])

    registerLayersPanel(interactiveMap, arcgisMap, view)

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
    registerLayersPanel(interactiveMap, arcgisMap, view)

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
    registerLayersPanel(interactiveMap, arcgisMap, view)

    const { default: WMSLayer } = await import('@arcgis/core/layers/WMSLayer.js')
    const mockLayer = new WMSLayer({ id: 'gep-test-dataset' })
    mockLayer.visible = false
    arcgisMap._layers.push(mockLayer)
    arcgisMap.findLayerById.mockReturnValue(mockLayer)

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = true
    checkbox.dataset.appLayerId = 'test-dataset'
    document.body.appendChild(checkbox)

    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(mockLayer.visible).toBe(true)
      expect(arcgisMap.add).not.toHaveBeenCalled()
    })
  })

  test('layer with sublayers config creates sublayers', async () => {
    registerLayersPanel(interactiveMap, arcgisMap, view)

    const { default: WMSLayer } = await import('@arcgis/core/layers/WMSLayer.js')

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = true
    checkbox.dataset.appLayerId = 'dataset-with-sublayers'
    document.body.appendChild(checkbox)

    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(WMSLayer).toHaveBeenCalledWith(
        expect.objectContaining({
          sublayers: [{ name: 'layer1' }, { name: 'layer2' }]
        })
      )
    })
  })

  test('GetFeatureInfo shows a generic message when fetch errors', async () => {
    vi.useFakeTimers()
    mockVisibleWmsLayers(arcgisMap)

    registerLayersPanel(interactiveMap, arcgisMap, view)

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

  test('shows no data when WMS layer has no visible sublayers', async () => {
    vi.useFakeTimers()
    mockVisibleWmsLayers(arcgisMap, [{
      sublayers: {
        filter: vi.fn(() => ({
          map: vi.fn(() => ({ toArray: vi.fn(() => []) }))
        }))
      }
    }])

    registerLayersPanel(interactiveMap, arcgisMap, view)

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
    mockVisibleWmsLayers(arcgisMap)

    registerLayersPanel(interactiveMap, arcgisMap, view)

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

  test('handles WMS layer with null sublayers', async () => {
    vi.useFakeTimers()
    mockVisibleWmsLayers(arcgisMap, [{ sublayers: null }])

    registerLayersPanel(interactiveMap, arcgisMap, view)

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
})
