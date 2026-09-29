// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/preact'
import { THEMED_DATASET } from './datasets/test-helpers/themed-dataset.js'

vi.mock('@defra/interactive-map', () => ({
  EVENTS: { MAP_STYLE_CHANGE: 'map:stylechange' }
}))

vi.mock('./summaries/grid/index.jsx', () => ({ createGridSummary: vi.fn() }))
vi.mock('./summaries/feature/index.jsx', () => ({ createFeatureSummary: vi.fn() }))
vi.mock('./datasets/hits.jsx', () => ({ createDatasetHits: vi.fn() }))
vi.mock('./inspection/index.js', () => ({ createInspection: vi.fn() }))
vi.mock('./datasets/attribution.js', () => ({ getAttribution: vi.fn(() => '© Ordnance Survey | Natural England') }))
vi.mock('./datasets/use-catalogue.js', () => ({ useCatalogue: vi.fn() }))
vi.mock('./datasets/use-linked-dataset.js', () => ({ useLinkedDataset: vi.fn() }))

vi.mock('./layer-controller.js', () => ({ createLayerController: vi.fn() }))

const { EVENTS } = await import('@defra/interactive-map')
const { createGridSummary } = await import('./summaries/grid/index.jsx')
const { createFeatureSummary } = await import('./summaries/feature/index.jsx')
const { createDatasetHits } = await import('./datasets/hits.jsx')
const { createInspection } = await import('./inspection/index.js')
const { getAttribution } = await import('./datasets/attribution.js')
const { createLayerController } = await import('./layer-controller.js')
const { useCatalogue } = await import('./datasets/use-catalogue.js')
const { useLinkedDataset } = await import('./datasets/use-linked-dataset.js')
const { LayersInit } = await import('./LayersInit.jsx')

const WOODLAND = { ...THEMED_DATASET, id: 'woodland', title: 'Ancient Woodland' }
const MAP_STYLE = { id: 'os-outdoor-ngd', attribution: '© Ordnance Survey' }

let view
let attributions
let olMap
let grid
let features
let datasetHits
let inspection
let layerController
let services
let listeners
let refs
let dispatch

function pluginState (overrides = {}) {
  return {
    catalogue: { query: '', expandedThemes: [], results: [], total: 0, attempt: 0, status: 'ready' },
    layers: [],
    inspection: { status: 'idle', hits: [], hit: null },
    ...overrides,
    dispatch,
    refs,
    useRef (key) {
      refs[key] ??= { current: null }
      return refs[key]
    }
  }
}

function props (overrides = {}) {
  return {
    mapState: { isMapReady: true, zoom: 8, mapStyle: MAP_STYLE, ...overrides.mapState },
    mapProvider: { map: olMap },
    pluginConfig: { ...overrides.pluginConfig },
    pluginState: overrides.pluginState ?? pluginState(),
    appState: { dispatch: vi.fn(), ...overrides.appState },
    services
  }
}

function renderInit (overrides = {}) {
  view = render(<LayersInit {...props(overrides)} />)
  return view
}

beforeEach(() => {
  attributions = document.createElement('div')
  attributions.className = 'im-c-attributions'
  document.body.appendChild(attributions)

  olMap = {}
  grid = { getHits: vi.fn(), clearSelection: vi.fn(), setVisible: vi.fn(), setZIndex: vi.fn(), dispose: vi.fn() }
  features = { getHits: vi.fn(), clearSelection: vi.fn(), setMapStyle: vi.fn(), setVisible: vi.fn(), setZIndex: vi.fn(), dispose: vi.fn() }
  datasetHits = { getHits: vi.fn(), clearSelection: vi.fn(), dispose: vi.fn() }
  inspection = {
    selectHit: vi.fn(),
    showHitList: vi.fn(),
    reconcile: vi.fn(),
    dispose: vi.fn()
  }
  layerController = {
    sync: vi.fn(),
    dispose: vi.fn()
  }
  listeners = new Map()
  services = {
    announce: vi.fn(),
    hints: { show: vi.fn() },
    eventBus: {
      on: vi.fn((event, handler) => listeners.set(event, handler)),
      off: vi.fn((event) => listeners.delete(event))
    }
  }
  refs = {}
  dispatch = vi.fn()

  vi.mocked(createGridSummary).mockReturnValue(grid)
  vi.mocked(createFeatureSummary).mockReturnValue(features)
  vi.mocked(createDatasetHits).mockReturnValue(datasetHits)
  vi.mocked(createInspection).mockReturnValue(inspection)
  vi.mocked(createLayerController).mockReturnValue(layerController)
})

afterEach(() => {
  attributions.remove()
})

describe('LayersInit', () => {
  test('identify reads current layer state and reconciles on theme changes without recreating sources', () => {
    const initial = { ...WOODLAND, ready: true }
    renderInit({ pluginState: pluginState({ layers: [initial] }) })
    const getLayers = createDatasetHits.mock.calls[0][1]
    expect(getLayers()).toEqual([initial])
    inspection.reconcile.mockClear()

    const switched = { ...initial, themeBand: 2 }
    view.rerender(<LayersInit {...props({ pluginState: pluginState({ layers: [switched] }) })} />)
    expect(getLayers()).toEqual([switched])
    expect(inspection.reconcile).toHaveBeenCalledOnce()
    expect(createDatasetHits).toHaveBeenCalledOnce()

    inspection.reconcile.mockClear()
    const edited = { ...switched, styleOverridesByTheme: { 2: { classes: [{ fill: [255, 0, 0, 1] }] } } }
    view.rerender(<LayersInit {...props({ pluginState: pluginState({ layers: [edited] }) })} />)
    expect(getLayers()).toEqual([edited])
    expect(inspection.reconcile).not.toHaveBeenCalled()
  })

  test('composes the fixed inspection sources directly', () => {
    renderInit()

    expect(createInspection).toHaveBeenCalledWith({
      map: olMap,
      eventBus: services.eventBus,
      sources: [datasetHits, grid, features],
      getInspectionState: expect.any(Function),
      dispatch,
      appDispatch: expect.any(Function),
      announce: services.announce
    })
    expect(createGridSummary).toHaveBeenCalledWith(services.eventBus, olMap)
    expect(createFeatureSummary).toHaveBeenCalledWith(olMap)
    expect(createDatasetHits).toHaveBeenCalledWith(olMap, expect.any(Function))
    expect(createLayerController).toHaveBeenCalledWith({
      map: olMap,
      summaries: { grid, features },
      loadDataset: expect.any(Function),
      onDatasetLoaded: expect.any(Function),
      onDatasetFailed: expect.any(Function)
    })
    expect(refs.inspection.current).toBe(inspection)
  })

  test('commits dataset loading outcomes and shows a hint for failures', () => {
    renderInit({ pluginState: pluginState({ layers: [{ id: 'woodland', title: 'Ancient Woodland', ready: false }] }) })
    const { onDatasetLoaded, onDatasetFailed } = createLayerController.mock.calls[0][0]

    onDatasetLoaded('woodland', { source: WOODLAND.source, minZoom: 9 })
    onDatasetFailed('woodland')

    expect(dispatch.mock.calls).toEqual([
      [{ type: 'DATASET_LOADED', payload: { id: 'woodland', source: WOODLAND.source, minZoom: 9 } }],
      [{ type: 'DATASET_FAILED', payload: { id: 'woodland', error: 'This dataset could not be added. Try again later.' } }]
    ])
    expect(services.hints.show).toHaveBeenCalledWith('Ancient Woodland could not be added')
  })

  test('loads the catalogue without waiting for the map', () => {
    const state = pluginState()
    renderInit({ mapState: { isMapReady: false }, pluginState: state })

    expect(useCatalogue).toHaveBeenCalledWith(state)
  })

  test('passes the linked dataset to its loader', () => {
    renderInit({ mapState: { isMapReady: false }, pluginConfig: { datasetId: 'woodland' } })

    expect(useLinkedDataset).toHaveBeenCalledWith({
      datasetId: 'woodland',
      isMapReady: false,
      dispatch,
      hints: services.hints
    })
  })

  test('waits for the map before creating inspection sources', () => {
    renderInit({ mapState: { isMapReady: false } })

    expect(createInspection).not.toHaveBeenCalled()
    expect(createGridSummary).not.toHaveBeenCalled()
  })

  test('points the feature summary at the current basemap and follows completed swaps', () => {
    renderInit()

    expect(features.setMapStyle).toHaveBeenCalledWith('os-outdoor-ngd')
    features.setMapStyle.mockClear()
    listeners.get(EVENTS.MAP_STYLE_CHANGE)({ mapStyleId: 'os-outdoor-raster' })
    expect(features.setMapStyle).toHaveBeenCalledWith('os-outdoor-raster')
  })

  test('writes the derived attribution', () => {
    const state = pluginState()
    renderInit({ pluginState: state })

    expect(getAttribution).toHaveBeenCalledWith(state, '© Ordnance Survey')
    expect(attributions.textContent).toBe('© Ordnance Survey | Natural England')
  })

  test('preserves inspection on reorder and updates it when a layer is hidden', () => {
    const state = pluginState({
      layers: [{ id: 'grid', ready: true }, { ...WOODLAND, ready: true }]
    })
    renderInit({ pluginState: state })

    expect(layerController.sync).toHaveBeenCalledWith(state.layers)
    expect(inspection.reconcile).toHaveBeenCalledTimes(1)

    layerController.sync.mockClear()
    inspection.reconcile.mockClear()
    const reordered = pluginState({
      layers: [{ ...WOODLAND, ready: true }, { id: 'grid', ready: true }]
    })
    view.rerender(<LayersInit {...props({ pluginState: reordered })} />)

    expect(layerController.sync).toHaveBeenCalledWith(reordered.layers)
    expect(inspection.reconcile).not.toHaveBeenCalled()

    const hidden = pluginState({
      layers: [{ ...WOODLAND, ready: true, hidden: true }, { id: 'grid', ready: true }]
    })
    view.rerender(<LayersInit {...props({ pluginState: hidden })} />)

    expect(inspection.reconcile).toHaveBeenCalledTimes(1)
  })

  test('tears down every resource it owns', () => {
    renderInit()

    view.unmount()

    expect(datasetHits.dispose).toHaveBeenCalled()
    expect(grid.dispose).toHaveBeenCalled()
    expect(features.dispose).toHaveBeenCalled()
    expect(inspection.dispose).toHaveBeenCalled()
    expect(layerController.dispose).toHaveBeenCalled()
    expect(refs.inspection.current).toBeNull()
    expect(services.eventBus.off).toHaveBeenCalledWith(EVENTS.MAP_STYLE_CHANGE, expect.any(Function))
  })
})
