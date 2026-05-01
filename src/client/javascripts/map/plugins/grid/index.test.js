// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('./grid-layer.js', () => ({
  createGridLayer: vi.fn()
}))

vi.mock('@defra/interactive-map', () => ({
  EVENTS: {
    MAP_CLICK: 'map:click',
    APP_PANEL_CLOSED: 'app:panelclosed'
  }
}))

const { createGridLayer } = await import('./grid-layer.js')
const { registerGridController } = await import('./index.js')
const { GRID_VISIBLE_MIN_ZOOM } = await import('./constants.js')

function createMapHarness () {
  const handlers = {}
  return {
    addPanel: vi.fn(),
    showPanel: vi.fn(),
    hidePanel: vi.fn(),
    on: vi.fn((event, handler) => {
      handlers[event] = handler
    }),
    _handlers: handlers
  }
}

function createMockGridLayer () {
  return {
    setEnabled: vi.fn(),
    highlightCell: vi.fn(),
    clearHighlight: vi.fn()
  }
}

describe('#registerGridController', () => {
  let interactiveMap
  let mockGridLayer
  let view
  const arcgisMap = {}

  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = '<div class="app-map"><div id="map-container"></div></div><div id="gep-grid-info-content"></div>'
    view = { container: document.getElementById('map-container') }
    interactiveMap = createMapHarness()
    mockGridLayer = createMockGridLayer()
    createGridLayer.mockReturnValue(mockGridLayer)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  test('creates grid layer on registration', () => {
    registerGridController(interactiveMap, arcgisMap, view)

    expect(createGridLayer).toHaveBeenCalledWith(interactiveMap, arcgisMap, view)
  })

  test('adds info panel for cell details', () => {
    registerGridController(interactiveMap, arcgisMap, view)

    expect(interactiveMap.addPanel).toHaveBeenCalledWith(
      'gep-grid-info',
      expect.objectContaining({
        id: 'gep-grid-info',
        label: 'Land model attributes',
        html: expect.stringContaining('class="app-map__grid-info-panel"'),
        tablet: expect.objectContaining({ slot: 'right-top', modal: false }),
        desktop: expect.objectContaining({ slot: 'right-top', modal: false })
      })
    )
  })

  test('setVisible(true) enables the grid layer', () => {
    const api = registerGridController(interactiveMap, arcgisMap, view)

    api.setVisible(true)

    expect(mockGridLayer.setEnabled).toHaveBeenCalledWith(true)
  })

  test('exposes the minimum usable grid zoom', () => {
    const api = registerGridController(interactiveMap, arcgisMap, view)

    expect(api.minZoom).toBe(GRID_VISIBLE_MIN_ZOOM)
  })

  test('setVisible(false) hides the grid layer and closes the cell info panel', () => {
    const api = registerGridController(interactiveMap, arcgisMap, view)

    api.setVisible(true)
    api.setVisible(false)

    expect(mockGridLayer.setEnabled).toHaveBeenLastCalledWith(false)
    expect(mockGridLayer.clearHighlight).toHaveBeenCalled()
    expect(interactiveMap.hidePanel).toHaveBeenCalledWith('gep-grid-info')
  })

  test('setVisible toggles the grid cursor class on the view container', () => {
    const api = registerGridController(interactiveMap, arcgisMap, view)

    api.setVisible(true)
    expect(view.container.classList.contains('app-map--grid')).toBe(true)

    api.setVisible(false)
    expect(view.container.classList.contains('app-map--grid')).toBe(false)
  })

  test('map click shows cell info panel when grid visible', () => {
    const api = registerGridController(interactiveMap, arcgisMap, view)
    api.setVisible(true)

    const clickHandler = interactiveMap._handlers['map:click']
    clickHandler({ coords: [418725, 385137] })

    vi.advanceTimersByTime(300)

    expect(mockGridLayer.highlightCell).toHaveBeenCalledWith(418720, 385130)
    expect(interactiveMap.showPanel).toHaveBeenCalledWith('gep-grid-info', { focus: false })
  })

  test('map click marks the grid info panel as open for layout', () => {
    const api = registerGridController(interactiveMap, arcgisMap, view)
    api.setVisible(true)

    const clickHandler = interactiveMap._handlers['map:click']
    clickHandler({ coords: [418725, 385137] })

    vi.advanceTimersByTime(300)

    expect(document.querySelector('.app-map').classList.contains('app-map--grid-info-open')).toBe(true)
  })

  test('map click does nothing when grid not visible', () => {
    registerGridController(interactiveMap, arcgisMap, view)

    const clickHandler = interactiveMap._handlers['map:click']
    clickHandler({ coords: [418725, 385137] })

    vi.advanceTimersByTime(300)

    expect(mockGridLayer.highlightCell).not.toHaveBeenCalled()
  })

  test('hiding the grid cancels a pending cell selection', () => {
    const api = registerGridController(interactiveMap, arcgisMap, view)
    api.setVisible(true)

    const clickHandler = interactiveMap._handlers['map:click']
    clickHandler({ coords: [418725, 385137] })
    api.setVisible(false)

    vi.advanceTimersByTime(300)

    expect(mockGridLayer.highlightCell).not.toHaveBeenCalled()
    expect(interactiveMap.showPanel).not.toHaveBeenCalled()
  })

  test('double click is ignored', () => {
    const api = registerGridController(interactiveMap, arcgisMap, view)
    api.setVisible(true)

    const clickHandler = interactiveMap._handlers['map:click']
    clickHandler({ coords: [418725, 385137] })
    clickHandler({ coords: [418725, 385137] })

    vi.advanceTimersByTime(300)

    expect(mockGridLayer.highlightCell).not.toHaveBeenCalled()
  })

  test('panel close clears cell highlight', () => {
    const api = registerGridController(interactiveMap, arcgisMap, view)
    api.setVisible(true)

    const clickHandler = interactiveMap._handlers['map:click']
    clickHandler({ coords: [418725, 385137] })
    vi.advanceTimersByTime(300)

    const closeHandler = interactiveMap._handlers['app:panelclosed']
    closeHandler({ panelId: 'gep-grid-info' })

    expect(mockGridLayer.clearHighlight).toHaveBeenCalled()
    expect(document.querySelector('.app-map').classList.contains('app-map--grid-info-open')).toBe(false)
  })

  test('other panel close does not clear highlight', () => {
    registerGridController(interactiveMap, arcgisMap, view)

    const closeHandler = interactiveMap._handlers['app:panelclosed']
    closeHandler({ panelId: 'other-panel' })

    expect(mockGridLayer.clearHighlight).not.toHaveBeenCalled()
  })
})
