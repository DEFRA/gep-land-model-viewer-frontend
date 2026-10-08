import { grid10mRecord } from '../fixtures/land-model.js'
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('./grid-layer.js', () => ({
  createGridLayer: vi.fn()
}))

vi.mock('./data.js', async importOriginal => ({
  ...await importOriginal(),
  getGridDetails: vi.fn(() => Promise.resolve(null))
}))

const { createGridLayer } = await import('./grid-layer.js')
const { getGridDetails } = await import('./data.js')
const { createGridSummary } = await import('./index.jsx')

function createMockGridLayer () {
  return {
    setEnabled: vi.fn(),
    setZIndex: vi.fn(),
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

  test.each([
    [12, 10, 466720, 475130, 'SE66727513'],
    [9, 100, 466700, 475100, 'SE667751'],
    [6, 1000, 466000, 475000, 'SE6675'],
    [3, 10000, 460000, 470000, 'SE67'],
    [0, 100000, 400000, 400000, 'SE']
  ])('at UK zoom %i selects a %im cell', (level, size, easting, northing, reference) => {
    zoom = level
    const hit = registeredSource().getHits([466725, 475137])[0]

    hit.select()

    expect(mockGridLayer.highlightCell).toHaveBeenCalledWith(easting, northing, size)
    expect(hit.render(null).props.unit).toEqual({ kind: 'grid', bngRef: reference, cellSize: size })
  })

  test('a hit keeps the cell size it was created with after zooming', () => {
    const summary = registeredSource()
    const fine = summary.getHits([466725, 475137])[0]
    zoom = 0
    const coarse = summary.getHits([466725, 475137])[0]
    zoom = 12

    fine.select()
    coarse.select()

    expect(fine.stillValid()).toBe(true)
    expect(mockGridLayer.highlightCell.mock.calls).toEqual([[466720, 475130, 10], [400000, 400000, 100000]])
    expect(fine.render(null).props.unit.cellSize).toBe(10)
    expect(coarse.render(null).props.unit.cellSize).toBe(100000)
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

    expect(mockGridLayer.highlightCell).toHaveBeenCalledWith(418720, 385130, 10)
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

  test('coarse cells load no details and are not shown as outside the sample area', async () => {
    zoom = 0
    const hit = registeredSource().getHits([418725, 385137])[0]

    expect(await hit.loadDetails({ signal: null })).toBeNull()
    expect(getGridDetails).not.toHaveBeenCalled()
    expect(hit.render(null).props.outsideSampleArea).toBe(false)
  })

  test('renders the clicked cell with no record when details are missing', () => {
    const source = registeredSource()
    const hit = source.getHits([418725, 385137])[0]
    const rendered = hit.render(null)

    expect(rendered.props.unit).toEqual({ kind: 'grid', bngRef: 'SK18728513', cellSize: 10 })
    expect(rendered.props.record).toBeNull()
    expect(rendered.props.outsideSampleArea).toBe(true)
  })

  test('keeps the clicked cell after the zoom changes', () => {
    const source = registeredSource()
    const hit = source.getHits([418725, 385137])[0]
    zoom = 18
    const rendered = hit.render(grid10mRecord)

    expect(rendered.props.unit.cellSize).toBe(10)
    expect(rendered.props.unit.bngRef).toBe('SK18728513')
    expect(rendered.props.record).toBe(grid10mRecord)
    expect(rendered.props.outsideSampleArea).toBe(false)
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
