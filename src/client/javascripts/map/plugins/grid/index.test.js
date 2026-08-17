import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('./grid-layer.js', () => ({
  createGridLayer: vi.fn()
}))

vi.mock('./data.js', () => ({
  getGridDetails: vi.fn(() => Promise.resolve(null))
}))

const { createGridLayer } = await import('./grid-layer.js')
const { getGridDetails } = await import('./data.js')
const { registerGridController } = await import('./index.js')
const { GRID_VISIBLE_MIN_ZOOM } = await import('./constants.js')

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
    olMap = {
      getView: vi.fn(() => ({ getZoom: vi.fn(() => 12) }))
    }
    interactiveMap = {}
    infoPanel = { activate: vi.fn(), deactivate: vi.fn() }
    mockGridLayer = createMockGridLayer()
    createGridLayer.mockReturnValue(mockGridLayer)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  function registeredSource () {
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

  test('setVisible(false) hides the grid layer and deactivates its source', () => {
    const api = registerGridController(interactiveMap, olMap, infoPanel)

    api.setVisible(true)
    const source = infoPanel.activate.mock.calls[0][0]
    api.setVisible(false)

    expect(mockGridLayer.setEnabled).toHaveBeenLastCalledWith(false)
    expect(infoPanel.deactivate).toHaveBeenCalledWith(source)
  })

  test('a click snaps to a cell and yields a Grid square hit', () => {
    const source = registeredSource()

    const hits = source.getHits([418725, 385137])

    expect(hits).toHaveLength(1)
    expect(hits[0].label).toBe('Grid square')
    expect(hits[0].panelTitle).toBe('Grid square')
    expect(mockGridLayer.highlightCell).not.toHaveBeenCalled()
  })

  test('selecting the hit highlights the snapped cell', () => {
    const source = registeredSource()

    source.getHits([418725, 385137])[0].select()

    expect(mockGridLayer.highlightCell).toHaveBeenCalledWith(418720, 385130)
  })

  test('coordinates outside the BNG extent yield no hits', () => {
    const source = registeredSource()

    expect(source.getHits([418725, -1])).toEqual([])
    expect(mockGridLayer.highlightCell).not.toHaveBeenCalled()
  })

  test('loadDetails fetches grid details by bng_ref', async () => {
    const source = registeredSource()

    await source.getHits([418725, 385137])[0].loadDetails({ signal: null })

    expect(getGridDetails).toHaveBeenCalledWith('SK18728513')
  })

  test('clearSelection clears the cell highlight', () => {
    const source = registeredSource()

    source.clearSelection()

    expect(mockGridLayer.clearHighlight).toHaveBeenCalled()
  })
})
