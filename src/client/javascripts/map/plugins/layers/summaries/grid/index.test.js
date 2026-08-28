import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('./grid-layer.js', () => ({
  createGridLayer: vi.fn()
}))

vi.mock('./data.js', () => ({
  getGridDetails: vi.fn(() => Promise.resolve(null))
}))

const { createGridLayer } = await import('./grid-layer.js')
const { getGridDetails } = await import('./data.js')
const { createGridSummary } = await import('./index.jsx')

function createMockGridLayer () {
  return {
    setEnabled: vi.fn(),
    highlightCell: vi.fn(),
    clearHighlight: vi.fn(),
    dispose: vi.fn()
  }
}

describe('#createGridSummary', () => {
  let eventBus
  let mockGridLayer
  let olMap
  let zoom

  beforeEach(() => {
    zoom = 12
    olMap = {
      getView: vi.fn(() => ({ getZoom: vi.fn(() => zoom) }))
    }
    eventBus = { on: vi.fn() }
    mockGridLayer = createMockGridLayer()
    createGridLayer.mockReturnValue(mockGridLayer)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  function registeredSource () {
    const summary = createGridSummary(eventBus, olMap)
    summary.setVisible(true)
    return summary
  }

  test('creates grid layer on registration', () => {
    createGridSummary(eventBus, olMap)

    expect(createGridLayer).toHaveBeenCalledWith(eventBus, olMap)
  })

  test('setVisible(true) enables the grid layer and its lifetime source', () => {
    const summary = createGridSummary(eventBus, olMap)

    summary.setVisible(true)

    expect(mockGridLayer.setEnabled).toHaveBeenCalledWith(true)
    expect(summary.getHits([418725, 385137])).toHaveLength(1)
  })

  test('setVisible(false) hides the grid layer and invalidates its source', () => {
    const summary = createGridSummary(eventBus, olMap)

    summary.setVisible(true)
    const hit = summary.getHits([418725, 385137])[0]
    summary.setVisible(false)

    expect(mockGridLayer.setEnabled).toHaveBeenLastCalledWith(false)
    expect(summary.getHits([418725, 385137])).toEqual([])
    expect(hit.stillValid()).toBe(false)
  })

  test('a zoom below the grid floor prevents hits and invalidates an existing hit', () => {
    const summary = registeredSource()
    const hit = summary.getHits([418725, 385137])[0]

    zoom = 8

    expect(summary.getHits([418725, 385137])).toEqual([])
    expect(hit.stillValid()).toBe(false)
  })

  test('a click snaps to a cell and yields a Grid square hit', () => {
    const source = registeredSource()

    const hits = source.getHits([418725, 385137])

    expect(hits).toHaveLength(1)
    expect(hits[0].label).toBe('Grid square')
    expect(hits[0].panelTitle).toBeUndefined()
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

  test('dispose clears the highlight and disposes the grid layer', () => {
    const summary = createGridSummary(eventBus, olMap)

    summary.dispose()

    expect(mockGridLayer.clearHighlight).toHaveBeenCalled()
    expect(mockGridLayer.dispose).toHaveBeenCalled()
  })
})
