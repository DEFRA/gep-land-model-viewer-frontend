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

const { EVENTS } = await import('@defra/interactive-map')
const { createGridSummary } = await import('./summaries/grid/index.jsx')
const { createFeatureSummary } = await import('./summaries/feature/index.jsx')
const { createDatasetHits } = await import('./datasets/hits.jsx')
const { createInspection } = await import('./inspection/index.js')
const { getAttribution } = await import('./datasets/attribution.js')
const { LayersInit } = await import('./LayersInit.jsx')

const DATASETS = [{ id: 'woodland', label: 'Ancient Woodland' }]
const MAP_STYLE = { id: 'os-outdoor-ngd', attribution: '© Ordnance Survey' }

let view
let attributions
let container
let olMap
let grid
let features
let datasetHits
let inspection
let services
let listeners
let refs
let dispatch

function pluginState (overrides = {}) {
  return {
    query: '',
    datasets: {},
    summaries: {},
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
    appState: { openPanels: {}, dispatch: vi.fn(), ...overrides.appState },
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
  container = document.createElement('div')
  container.className = 'app-map'

  olMap = { getTargetElement: vi.fn(() => ({ closest: () => container })) }
  grid = { getHits: vi.fn(), clearSelection: vi.fn(), setVisible: vi.fn(), dispose: vi.fn() }
  features = { getHits: vi.fn(), clearSelection: vi.fn(), setMapStyle: vi.fn(), setVisible: vi.fn(), dispose: vi.fn() }
  datasetHits = { getHits: vi.fn(), clearSelection: vi.fn(), dispose: vi.fn() }
  inspection = {
    selectHit: vi.fn(),
    showHitList: vi.fn(),
    reconcile: vi.fn(),
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
    expect(refs.inspection.current).toBe(inspection)
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

  test('updates attribution from configured datasets and committed model changes', () => {
    const firstState = pluginState()
    renderInit({ pluginState: firstState })

    expect(getAttribution).toHaveBeenCalledWith(olMap, DATASETS, '© Ordnance Survey')
    expect(attributions.textContent).toBe('© Ordnance Survey | Natural England')

    const nextProps = props({
      pluginState: pluginState({ datasets: { woodland: { visible: true } } })
    })
    view.rerender(<LayersInit {...nextProps} />)
    expect(getAttribution).toHaveBeenCalledTimes(2)
  })

  test('applies a summary batch before reconciling inspection once', () => {
    renderInit({ pluginState: pluginState({ summaries: { grid: true } }) })

    expect(grid.setVisible).toHaveBeenCalledWith(true)
    expect(features.setVisible).toHaveBeenCalledWith(false)
    expect(inspection.reconcile).toHaveBeenCalledTimes(1)
  })

  test('tracks the existing Info panel open class', () => {
    renderInit({ appState: { openPanels: { gepInfoPanel: {} } } })
    expect(container.classList.contains('app-map--info-panel-open')).toBe(true)

    view.rerender(<LayersInit {...props({ appState: { openPanels: {} } })} />)
    expect(container.classList.contains('app-map--info-panel-open')).toBe(false)
  })

  test('tears down every resource it owns', () => {
    renderInit()

    view.unmount()

    expect(datasetHits.dispose).toHaveBeenCalled()
    expect(grid.dispose).toHaveBeenCalled()
    expect(features.dispose).toHaveBeenCalled()
    expect(inspection.dispose).toHaveBeenCalled()
    expect(refs.inspection.current).toBeNull()
    expect(services.eventBus.off).toHaveBeenCalledWith(EVENTS.MAP_STYLE_CHANGE, expect.any(Function))
  })
})
