// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/preact'

vi.mock('@defra/interactive-map', () => ({
  EVENTS: { MAP_STYLE_CHANGE: 'map:stylechange' }
}))

vi.mock('./summaries/grid/index.jsx', () => ({ createGridSummary: vi.fn() }))
vi.mock('./summaries/feature/index.jsx', () => ({ createFeatureSummary: vi.fn() }))
vi.mock('./datasets/hits.jsx', () => ({ createDatasetHits: vi.fn() }))
vi.mock('./inspection/index.js', () => ({ createInspection: vi.fn() }))
vi.mock('./datasets/attribution.js', () => ({ getAttribution: vi.fn(() => '© Ordnance Survey | Natural England') }))
vi.mock('./layer-controller.js', () => ({ createLayerController: vi.fn() }))

const { EVENTS } = await import('@defra/interactive-map')
const { createGridSummary } = await import('./summaries/grid/index.jsx')
const { createFeatureSummary } = await import('./summaries/feature/index.jsx')
const { createDatasetHits } = await import('./datasets/hits.jsx')
const { createInspection } = await import('./inspection/index.js')
const { getAttribution } = await import('./datasets/attribution.js')
const { createLayerController } = await import('./layer-controller.js')
const { LayersInit } = await import('./LayersInit.jsx')

const DATASETS = [{ id: 'woodland', label: 'Ancient Woodland' }]
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
    query: '',
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
    pluginConfig: { datasets: DATASETS },
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
    expect(createDatasetHits).toHaveBeenCalledWith(olMap, DATASETS)
    expect(createLayerController).toHaveBeenCalledWith({
      map: olMap,
      datasets: DATASETS,
      summaries: { grid, features },
      onDatasetLoaded: expect.any(Function),
      onDatasetFailed: expect.any(Function)
    })
    expect(refs.inspection.current).toBe(inspection)
  })

  test('commits dataset loading outcomes from the layer controller', () => {
    renderInit()
    const { onDatasetLoaded, onDatasetFailed } = createLayerController.mock.calls[0][0]

    onDatasetLoaded('woodland', { minZoom: 9 })
    onDatasetFailed('woodland')

    expect(dispatch.mock.calls).toEqual([
      [{ type: 'DATASET_LOADED', payload: { id: 'woodland', minZoom: 9 } }],
      [{ type: 'REMOVE_LAYER', payload: { id: 'woodland' } }]
    ])
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

    expect(getAttribution).toHaveBeenCalledWith(DATASETS, state, '© Ordnance Survey')
    expect(attributions.textContent).toBe('© Ordnance Survey | Natural England')
  })

  test('preserves inspection on reorder and updates it when a layer is hidden', () => {
    const state = pluginState({
      layers: [{ id: 'grid', ready: true }, { id: 'woodland', ready: true }]
    })
    renderInit({ pluginState: state })

    expect(layerController.sync).toHaveBeenCalledWith(state.layers)
    expect(inspection.reconcile).toHaveBeenCalledTimes(1)

    layerController.sync.mockClear()
    inspection.reconcile.mockClear()
    const reordered = pluginState({
      layers: [{ id: 'woodland', ready: true }, { id: 'grid', ready: true }]
    })
    view.rerender(<LayersInit {...props({ pluginState: reordered })} />)

    expect(layerController.sync).toHaveBeenCalledWith(reordered.layers)
    expect(inspection.reconcile).not.toHaveBeenCalled()

    const hidden = pluginState({
      layers: [{ id: 'woodland', ready: true, hidden: true }, { id: 'grid', ready: true }]
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
