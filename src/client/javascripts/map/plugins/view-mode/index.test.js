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
    setView: vi.fn(),
    hidePanel: vi.fn(),
    on: vi.fn((event, handler) => { handlers[event] = handler }),
    _handlers: handlers
  }
}

function createView (zoom = 14, minZoom = 5) {
  return {
    zoom,
    center: { x: 418700, y: 385100 },
    constraints: { minZoom, maxZoom: 20 }
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
  let view
  let grid

  beforeEach(() => {
    mountPanelDom()
    interactiveMap = createMapHarness()
    view = createView()
    grid = createGridApi()
  })

  afterEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  test('switching to grid mode locks min zoom and enables grid', () => {
    registerViewMode(interactiveMap, view, { grid })

    clickOption('grid')

    expect(view.constraints.minZoom).toBe(GRID_VISIBLE_MIN_ZOOM)
    expect(grid.setVisible).toHaveBeenLastCalledWith(true)
  })

  test('switching to grid mode zooms in if currently zoomed out', () => {
    view.zoom = 14
    registerViewMode(interactiveMap, view, { grid })

    clickOption('grid')

    expect(interactiveMap.setView).toHaveBeenCalledWith({ center: [418700, 385100], zoom: GRID_VISIBLE_MIN_ZOOM })
  })

  test('switching to grid mode does not zoom if already at threshold', () => {
    view.zoom = GRID_VISIBLE_MIN_ZOOM
    registerViewMode(interactiveMap, view, { grid })

    clickOption('grid')

    expect(interactiveMap.setView).not.toHaveBeenCalled()
  })

  test('switching back to map mode restores original min zoom', () => {
    view.constraints.minZoom = 5
    registerViewMode(interactiveMap, view, { grid })

    clickOption('grid')
    clickOption('map')

    expect(view.constraints.minZoom).toBe(5)
    expect(grid.setVisible).toHaveBeenLastCalledWith(false)
  })

  test('switching back to map mode refreshes zoom button state after relaxing min zoom', () => {
    view = createView(GRID_VISIBLE_MIN_ZOOM, 5)
    registerViewMode(interactiveMap, view, { grid })

    clickOption('grid')
    clickOption('map')

    expect(interactiveMap.emit).toHaveBeenLastCalledWith('map:move', {
      zoom: GRID_VISIBLE_MIN_ZOOM,
      isAtMaxZoom: false,
      isAtMinZoom: false
    })
  })

  test('clicking disabled feature option is a no-op', () => {
    registerViewMode(interactiveMap, view, { grid })

    clickOption('feature')

    expect(grid.setVisible).not.toHaveBeenCalled()
    expect(view.constraints.minZoom).toBe(5)
  })

  test('clicking the active mode is a no-op', () => {
    registerViewMode(interactiveMap, view, { grid })

    clickOption('map')

    expect(grid.setVisible).not.toHaveBeenCalled()
    expect(interactiveMap.setView).not.toHaveBeenCalled()
  })

  test('panel re-renders after mode change to update aria-pressed', () => {
    registerViewMode(interactiveMap, view, { grid })

    clickOption('grid')

    const gridOpt = document.querySelector('[data-app-view-mode="grid"]')
    const map = document.querySelector('[data-app-view-mode="map"]')
    expect(gridOpt.getAttribute('aria-pressed')).toBe('true')
    expect(map.getAttribute('aria-pressed')).toBe('false')
  })

  test('button label updates to reflect the active mode', () => {
    registerViewMode(interactiveMap, view, { grid })

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
    registerViewMode(interactiveMap, view, { grid })

    clickOption('grid')

    expect(interactiveMap.hidePanel).toHaveBeenCalledWith('gep-view-mode-options')
  })

  test('panel content is re-rendered when the panel reopens', () => {
    registerViewMode(interactiveMap, view, { grid })

    clickOption('grid')

    document.getElementById('gep-view-mode-content').innerHTML = renderViewModePanelHtml('map')

    interactiveMap._handlers['app:panelopened']({ panelId: 'gep-view-mode-options' })

    expect(document.querySelector('[data-app-view-mode="grid"]').getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelector('[data-app-view-mode="map"]').getAttribute('aria-pressed')).toBe('false')
  })

  test('clicking outside any mode button is a no-op', () => {
    registerViewMode(interactiveMap, view, { grid })

    document.body.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true }))

    expect(grid.setVisible).not.toHaveBeenCalled()
    expect(interactiveMap.setView).not.toHaveBeenCalled()
  })
})
