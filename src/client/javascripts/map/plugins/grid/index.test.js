// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('./grid-layer.js', () => ({
  createGridLayer: vi.fn()
}))

const { createGridLayer } = await import('./grid-layer.js')
const { registerGridController } = await import('./index.js')
const { GRID_VISIBLE_MIN_ZOOM } = await import('./constants.js')
const { renderCellInfoHtml } = await import('./render.js')

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
  let olMap
  let infoPanel

  beforeEach(() => {
    document.body.innerHTML = '<div class="app-map"><div id="map-container"></div></div>'
    olMap = {
      getTargetElement: vi.fn(() => document.getElementById('map-container'))
    }
    interactiveMap = {}
    infoPanel = { activate: vi.fn(), deactivate: vi.fn() }
    mockGridLayer = createMockGridLayer()
    createGridLayer.mockReturnValue(mockGridLayer)
  })

  afterEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  function registeredInspector () {
    const api = registerGridController(interactiveMap, olMap, infoPanel)
    api.setVisible(true)
    return infoPanel.activate.mock.calls[0][0]
  }

  test('creates grid layer on registration', () => {
    registerGridController(interactiveMap, olMap, infoPanel)

    expect(createGridLayer).toHaveBeenCalledWith(interactiveMap, olMap)
  })

  test('exposes the minimum usable grid zoom', () => {
    const api = registerGridController(interactiveMap, olMap, infoPanel)

    expect(api.minZoom).toBe(GRID_VISIBLE_MIN_ZOOM)
  })

  test('setVisible(true) enables the grid layer and activates its inspector', () => {
    const api = registerGridController(interactiveMap, olMap, infoPanel)

    api.setVisible(true)

    expect(mockGridLayer.setEnabled).toHaveBeenCalledWith(true)
    expect(infoPanel.activate).toHaveBeenCalled()
  })

  test('setVisible(false) hides the grid layer, clears the highlight and deactivates', () => {
    const api = registerGridController(interactiveMap, olMap, infoPanel)

    api.setVisible(true)
    const inspector = infoPanel.activate.mock.calls[0][0]
    api.setVisible(false)

    expect(mockGridLayer.setEnabled).toHaveBeenLastCalledWith(false)
    expect(mockGridLayer.clearHighlight).toHaveBeenCalled()
    expect(infoPanel.deactivate).toHaveBeenCalledWith(inspector)
  })

  test('setVisible toggles the grid cursor class on the map container', () => {
    const api = registerGridController(interactiveMap, olMap, infoPanel)
    const container = document.getElementById('map-container')

    api.setVisible(true)
    expect(container.classList.contains('app-map--grid')).toBe(true)

    api.setVisible(false)
    expect(container.classList.contains('app-map--grid')).toBe(false)
  })

  test('hitTest snaps the click to a cell and highlights it', () => {
    const inspector = registeredInspector()

    const cell = inspector.hitTest([418725, 385137])

    expect(mockGridLayer.highlightCell).toHaveBeenCalledWith(418720, 385130)
    expect(cell).toEqual(expect.objectContaining({ easting: 418720, northing: 385130 }))
  })

  test('loadDetails resolves null until real cell data exists', async () => {
    const inspector = registeredInspector()

    await expect(inspector.loadDetails()).resolves.toBeNull()
  })

  test('renderHtml is the cell info renderer', () => {
    const inspector = registeredInspector()

    expect(inspector.renderHtml).toBe(renderCellInfoHtml)
  })

  test('clearSelection clears the cell highlight', () => {
    const inspector = registeredInspector()

    inspector.clearSelection()

    expect(mockGridLayer.clearHighlight).toHaveBeenCalled()
  })
})
