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
    highlightCells: vi.fn(),
    clearHighlight: vi.fn(),
    dispose: vi.fn()
  }
}

describe('#createGridSummary', () => {
  let eventBus
  let mockGridLayer
  let olMap
  let zoom
  const layerSource = {
    url: '/api/land-model/grid/layer/assets/10.tif?v=1',
    bands: {},
    fgbs: { 100000: '/api/land-model/grid/layer/assets/100000.fgb?v=2' }
  }

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
    const summary = createGridSummary(eventBus, olMap, () => [{ id: 'grid', ready: true, source: layerSource }])
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

    expect(mockGridLayer.highlightCells).toHaveBeenCalledWith([[easting, northing, easting + size, northing + size]])
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
    expect(mockGridLayer.highlightCells.mock.calls).toEqual([[[[466720, 475130, 466730, 475140]]], [[[400000, 400000, 500000, 500000]]]])
    expect(fine.render(null).props.unit.cellSize).toBe(10)
    expect(coarse.render(null).props.unit.cellSize).toBe(100000)
  })

  test('a click snaps to a cell and yields a Grid square hit', () => {
    const source = registeredSource()

    const hits = source.getHits([418725, 385137])

    expect(hits).toHaveLength(1)
    expect(hits[0].label).toBe('Grid square')
    expect(hits[0].panelTitle).toBeUndefined()
    expect(mockGridLayer.highlightCells).not.toHaveBeenCalled()
  })

  test('selecting the hit highlights the snapped cell', () => {
    const source = registeredSource()

    source.getHits([418725, 385137])[0].select()

    expect(mockGridLayer.highlightCells).toHaveBeenCalledWith([[418720, 385130, 418730, 385140]])
  })

  test('coordinates outside the BNG extent yield no hits', () => {
    const source = registeredSource()

    expect(source.getHits([418725, -1])).toEqual([])
    expect(mockGridLayer.highlightCells).not.toHaveBeenCalled()
  })

  test('loadDetails gets the cell\'s details using its bounds and the grid layer\'s source', async () => {
    const source = registeredSource()

    await source.getHits([418725, 385137])[0].loadDetails()

    expect(getGridDetails).toHaveBeenCalledWith({ kind: 'grid', bngRef: 'SK18728513', cellSize: 10 }, [418720, 385130, 418730, 385140], layerSource)
  })

  test('loadDetails reads coarse cells too', async () => {
    zoom = 0
    const hit = registeredSource().getHits([418725, 385137])[0]

    await hit.loadDetails()

    expect(getGridDetails).toHaveBeenCalledWith({ kind: 'grid', bngRef: 'SK', cellSize: 100000 }, [400000, 300000, 500000, 400000], layerSource)
  })

  test('renders the clicked cell with no record when details are missing', () => {
    const source = registeredSource()
    const hit = source.getHits([418725, 385137])[0]
    const rendered = hit.render(null)

    expect(rendered.props.unit).toEqual({ kind: 'grid', bngRef: 'SK18728513', cellSize: 10 })
    expect(rendered.props.record).toBeNull()
  })

  test('keeps the clicked cell after the zoom changes', () => {
    const source = registeredSource()
    const hit = source.getHits([418725, 385137])[0]
    zoom = 18
    const rendered = hit.render(grid10mRecord)

    expect(rendered.props.unit.cellSize).toBe(10)
    expect(rendered.props.unit.bngRef).toBe('SK18728513')
    expect(rendered.props.record).toBe(grid10mRecord)
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

  describe('selection', () => {
    const FIRST = [466725, 475137]
    const SECOND = [466825, 475137]
    const FIRST_EXTENT = [466700, 475100, 466800, 475200]
    const SECOND_EXTENT = [466800, 475100, 466900, 475200]

    let summary
    let selection

    beforeEach(() => {
      zoom = 9
      summary = registeredSource()
      selection = summary.selection
    })

    test('toggling a square selects and highlights it straight away', () => {
      expect(selection.toggleAt(FIRST)).toBe(true)

      expect(selection.isEmpty()).toBe(false)
      expect(selection.title()).toBe('Grid square')
      expect(selection.label()).toBe('1 grid square selected')
      expect(mockGridLayer.highlightCells).toHaveBeenCalledWith([FIRST_EXTENT])
    })

    test('adds and removes squares', () => {
      selection.toggleAt(FIRST)
      selection.toggleAt(SECOND)

      expect(selection.title()).toBe('Grid squares')
      expect(selection.label()).toBe('2 grid squares selected')
      expect(mockGridLayer.highlightCells).toHaveBeenLastCalledWith([FIRST_EXTENT, SECOND_EXTENT])

      selection.toggleAt(FIRST)

      expect(selection.label()).toBe('1 grid square selected')
      expect(mockGridLayer.highlightCells).toHaveBeenLastCalledWith([SECOND_EXTENT])
    })

    test('removing the last square empties the selection', () => {
      selection.toggleAt(FIRST)

      selection.toggleAt(FIRST)

      expect(selection.isEmpty()).toBe(true)
    })

    test('a square of another size replaces the selection', () => {
      selection.toggleAt(FIRST)
      selection.toggleAt(SECOND)
      zoom = 6

      selection.toggleAt(FIRST)

      expect(selection.label()).toBe('1 grid square selected')
      expect(mockGridLayer.highlightCells).toHaveBeenLastCalledWith([[466000, 475000, 467000, 476000]])
    })

    test('carries on from a square chosen by a plain click', () => {
      summary.getHits(FIRST)[0].select()

      selection.toggleAt(SECOND)

      expect(selection.label()).toBe('2 grid squares selected')
    })

    test('nothing changes with no square under the pointer, and the selection is no longer valid while hidden', () => {
      expect(selection.toggleAt([418725, -1])).toBe(false)

      summary.setVisible(false)

      expect(selection.toggleAt(FIRST)).toBe(false)
      expect(selection.isEmpty()).toBe(true)
      expect(selection.stillValid()).toBe(false)
    })

    test('clearSelection empties the selection', () => {
      selection.toggleAt(FIRST)

      summary.clearSelection()

      expect(selection.isEmpty()).toBe(true)
      expect(mockGridLayer.clearHighlight).toHaveBeenCalled()
    })

    test('loads each square once while selected, and again after a failure', async () => {
      getGridDetails.mockRejectedValueOnce(new Error('offline'))
      selection.toggleAt(FIRST)
      await expect(selection.loadDetails()).rejects.toThrow('offline')

      selection.toggleAt(SECOND)
      await selection.loadDetails()
      await selection.loadDetails()

      expect(getGridDetails.mock.calls.map(([unit]) => unit.bngRef)).toEqual(['SE667751', 'SE667751', 'SE668751'])
    })

    test('a selection of one renders as the plain-click summary', async () => {
      selection.toggleAt(FIRST)
      const hit = summary.getHits(FIRST)[0]

      const details = await selection.loadDetails()

      expect(selection.render(details).props).toEqual(hit.render(details.record).props)
    })

    test('combines the selected squares and renders what was loaded, not the live selection', async () => {
      getGridDetails
        .mockResolvedValueOnce({ landCover: { dominant: { label: 'Woodland' }, intersections: [{ label: 'Woodland', area: 10000, percentage: 100 }] } })
        .mockResolvedValueOnce(null)
      selection.toggleAt(FIRST)
      selection.toggleAt(SECOND)

      const details = await selection.loadDetails()
      selection.toggleAt(FIRST)

      expect(details.record.landCover.intersections).toEqual([{ label: 'Woodland', area: 10000, percentage: 50 }])
      expect(details.units.map(({ bngRef }) => bngRef)).toEqual(['SE667751', 'SE668751'])
      expect(selection.render(details).props.header.props).toEqual({ count: 2, label: 'grid squares' })
    })
  })
})
