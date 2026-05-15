// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('@defra/interactive-map', () => ({
  EVENTS: {
    APP_PANEL_OPENED: 'app:panelopened',
    MAP_MOVE: 'map:move'
  }
}))

const { registerViewMode } = await import('./index.js')
const { renderViewModePanelHtml } = await import('./render.js')
const { GRID_VISIBLE_MIN_ZOOM } = await import('../grid/constants.js')

function createMapHarness () {
  const handlers = {}
  return {
    addButton: vi.fn(),
    emit: vi.fn(),
    hidePanel: vi.fn(),
    on: vi.fn((event, handler) => { handlers[event] = handler }),
    _handlers: handlers
  }
}

function createOlMapMock (zoom = 14, minZoom = 5) {
  let currentMinZoom = minZoom
  const view = {
    getZoom: vi.fn(() => zoom),
    getMinZoom: vi.fn(() => currentMinZoom),
    getMaxZoom: vi.fn(() => 20),
    setMinZoom: vi.fn((z) => { currentMinZoom = z }),
    getCenter: vi.fn(() => [418700, 385100]),
    animate: vi.fn()
  }
  return {
    getView: vi.fn(() => view),
    getTargetElement: vi.fn(() => document.getElementById('map-container')),
    _view: view
  }
}

function createGridApi () {
  return {
    minZoom: GRID_VISIBLE_MIN_ZOOM,
    setVisible: vi.fn()
  }
}

function mountPanelDom (mode = 'map') {
  document.body.innerHTML = `
    <div class="app-map"><div id="map-container"></div></div>
    <button class="im-c-map-button im-c-map-button--gep-view-mode"><span>Map view</span></button>
    <div id="gep-view-mode-content">${renderViewModePanelHtml(mode)}</div>
  `
}

function clickOption (modeId) {
  const button = document.querySelector(`[data-app-view-mode="${modeId}"]`)
  button.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true }))
}

describe('#registerViewMode', () => {
  let interactiveMap
  let olMap
  let grid

  beforeEach(() => {
    mountPanelDom()
    interactiveMap = createMapHarness()
    olMap = createOlMapMock()
    grid = createGridApi()
  })

  afterEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  test('switching to grid mode locks min zoom and enables grid', () => {
    olMap = createOlMapMock(GRID_VISIBLE_MIN_ZOOM)
    registerViewMode(interactiveMap, olMap, { grid })

    clickOption('grid')

    const view = olMap.getView()
    expect(view.setMinZoom).toHaveBeenCalledWith(GRID_VISIBLE_MIN_ZOOM)
    expect(grid.setVisible).toHaveBeenLastCalledWith(true)
  })

  test('switching to grid mode zooms in if currently zoomed out', () => {
    olMap = createOlMapMock(8)
    registerViewMode(interactiveMap, olMap, { grid })

    clickOption('grid')

    expect(olMap._view.animate).toHaveBeenCalledWith({
      center: [418700, 385100],
      zoom: GRID_VISIBLE_MIN_ZOOM
    }, expect.any(Function))
    expect(olMap._view.setMinZoom).not.toHaveBeenCalled()

    olMap._view.animate.mock.calls[0][1]()

    expect(olMap._view.setMinZoom).toHaveBeenCalledWith(GRID_VISIBLE_MIN_ZOOM)
  })

  test('switching to grid mode does not zoom if already at threshold', () => {
    olMap = createOlMapMock(GRID_VISIBLE_MIN_ZOOM)
    registerViewMode(interactiveMap, olMap, { grid })

    clickOption('grid')

    expect(olMap._view.animate).not.toHaveBeenCalled()
  })

  test('switching back to map mode restores original min zoom', () => {
    olMap = createOlMapMock(14, 5)
    registerViewMode(interactiveMap, olMap, { grid })

    clickOption('grid')
    clickOption('map')

    const view = olMap.getView()
    expect(view.setMinZoom).toHaveBeenLastCalledWith(5)
    expect(grid.setVisible).toHaveBeenLastCalledWith(false)
  })

  test('switching back to map mode refreshes zoom button state', () => {
    olMap = createOlMapMock(GRID_VISIBLE_MIN_ZOOM, 5)
    registerViewMode(interactiveMap, olMap, { grid })

    clickOption('grid')
    clickOption('map')

    expect(interactiveMap.emit).toHaveBeenLastCalledWith('map:move', expect.objectContaining({
      zoom: GRID_VISIBLE_MIN_ZOOM,
      isAtMinZoom: false
    }))
  })

  test('clicking disabled feature option is a no-op', () => {
    registerViewMode(interactiveMap, olMap, { grid })

    clickOption('feature')

    expect(grid.setVisible).not.toHaveBeenCalled()
  })

  test('clicking the active mode is a no-op', () => {
    registerViewMode(interactiveMap, olMap, { grid })

    clickOption('map')

    expect(grid.setVisible).not.toHaveBeenCalled()
    expect(olMap._view.animate).not.toHaveBeenCalled()
    expect(olMap._view.setMinZoom).not.toHaveBeenCalled()
  })

  test('panel re-renders after mode change to update aria-pressed', () => {
    registerViewMode(interactiveMap, olMap, { grid })

    clickOption('grid')

    const gridOpt = document.querySelector('[data-app-view-mode="grid"]')
    const mapOpt = document.querySelector('[data-app-view-mode="map"]')
    expect(gridOpt.getAttribute('aria-pressed')).toBe('true')
    expect(mapOpt.getAttribute('aria-pressed')).toBe('false')
  })

  test('button label updates to reflect the active mode', () => {
    registerViewMode(interactiveMap, olMap, { grid })

    clickOption('grid')

    expect(interactiveMap.addButton).toHaveBeenCalledWith(
      'gep-view-mode',
      expect.objectContaining({
        id: 'gep-view-mode',
        label: 'Grid view',
        panelId: 'gep-view-mode-options',
        mobile: expect.objectContaining({ showLabel: true })
      })
    )
  })

  test('selecting a mode closes the popover', () => {
    registerViewMode(interactiveMap, olMap, { grid })

    clickOption('grid')

    expect(interactiveMap.hidePanel).toHaveBeenCalledWith('gep-view-mode-options')
  })

  test('panel content is re-rendered when the panel reopens', () => {
    registerViewMode(interactiveMap, olMap, { grid })

    clickOption('grid')

    document.getElementById('gep-view-mode-content').innerHTML = renderViewModePanelHtml('map')

    interactiveMap._handlers['app:panelopened']({ panelId: 'gep-view-mode-options' })

    expect(document.querySelector('[data-app-view-mode="grid"]').getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelector('[data-app-view-mode="map"]').getAttribute('aria-pressed')).toBe('false')
  })

  test('clicking outside any mode button is a no-op', () => {
    registerViewMode(interactiveMap, olMap, { grid })

    document.body.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true }))

    expect(grid.setVisible).not.toHaveBeenCalled()
    expect(olMap._view.animate).not.toHaveBeenCalled()
    expect(olMap._view.setMinZoom).not.toHaveBeenCalled()
  })
})
