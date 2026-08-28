import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('@defra/interactive-map', () => ({
  EVENTS: { APP_PANEL_CLOSED: 'app:panelclosed' }
}))

vi.mock('../../../pointer.js', () => ({ isCoarsePointer: vi.fn(() => false) }))

const { isCoarsePointer } = await import('../../../pointer.js')
const { createInspection } = await import('./index.js')
const { initialState, actions } = await import('../reducer.js')

function createMapHarness () {
  const handlers = {}
  return {
    handlers,
    on: vi.fn((event, handler) => { handlers[event] = handler }),
    un: vi.fn((event, handler) => {
      if (handlers[event] === handler) {
        delete handlers[event]
      }
    })
  }
}

function createEventBusHarness () {
  const handlers = {}
  return {
    handlers,
    on: vi.fn((event, handler) => { handlers[event] = handler }),
    off: vi.fn((event, handler) => {
      if (handlers[event] === handler) {
        delete handlers[event]
      }
    })
  }
}

function hit (label, overrides = {}) {
  return {
    label,
    select: vi.fn(),
    stillValid: vi.fn(() => true),
    loadDetails: vi.fn(async () => ({ label })),
    render: vi.fn(() => null),
    ...overrides
  }
}

function sourceWith (getHits) {
  return {
    getHits: typeof getHits === 'function' ? vi.fn(getHits) : vi.fn(async () => getHits),
    clearSelection: vi.fn()
  }
}

function makeHarness (sources = []) {
  let state = initialState
  const map = createMapHarness()
  const eventBus = createEventBusHarness()
  const appDispatch = vi.fn()
  const announce = vi.fn()
  const pluginDispatch = vi.fn((action) => {
    state = actions[action.type]?.(state, action.payload) ?? state
  })
  const inspection = createInspection({
    map,
    eventBus,
    sources,
    getInspectionState: () => state.inspection,
    dispatch: pluginDispatch,
    appDispatch,
    announce
  })

  return {
    map,
    eventBus,
    appDispatch,
    announce,
    pluginDispatch,
    inspection,
    get state () { return state }
  }
}

let harness

beforeEach(() => {
  vi.mocked(isCoarsePointer).mockReturnValue(false)
  harness = makeHarness()
})

afterEach(() => {
  harness.inspection.dispose()
  vi.restoreAllMocks()
})

function useSources (...sources) {
  harness.inspection.dispose()
  harness = makeHarness(sources)
}

function inspectAt (coordinate = [1, 2]) {
  return harness.map.handlers.singleclick({ coordinate })
}

describe('#createInspection', () => {
  test('owns map and panel-close listeners for its lifetime', () => {
    expect(harness.map.on).toHaveBeenCalledWith('singleclick', expect.any(Function))
    expect(harness.eventBus.on).toHaveBeenCalledWith('app:panelclosed', expect.any(Function))

    harness.inspection.dispose()

    expect(harness.map.un).toHaveBeenCalledWith('singleclick', expect.any(Function))
    expect(harness.eventBus.off).toHaveBeenCalledWith('app:panelclosed', expect.any(Function))
  })

  test('uses click for a coarse pointer', () => {
    harness.inspection.dispose()
    vi.mocked(isCoarsePointer).mockReturnValue(true)
    harness = makeHarness()

    expect(harness.map.on).toHaveBeenCalledWith('click', expect.any(Function))
  })

  test('reports an empty result without opening the panel', async () => {
    useSources(sourceWith([]))

    await inspectAt()

    expect(harness.state.inspection.status).toBe('empty')
    expect(harness.appDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'OPEN_PANEL' }))
    expect(harness.announce).toHaveBeenLastCalledWith('No information found at this location')
  })

  test('sorts multiple hits, opens the panel and shows the list', async () => {
    const source = sourceWith([
      hit('Grid square'),
      hit('Ancient Woodland', { panelTitle: 'Data layer attributes' })
    ])
    useSources(source)

    await inspectAt()

    expect(harness.state.inspection.status).toBe('list')
    expect(harness.state.inspection.hits).toEqual([
      { id: 0, label: 'Ancient Woodland', panelTitle: 'Data layer attributes' },
      { id: 1, label: 'Grid square', panelTitle: undefined }
    ])
    expect(harness.appDispatch).toHaveBeenCalledWith({
      type: 'OPEN_PANEL',
      payload: { panelId: 'gepInfoPanel', focusOnOpen: false }
    })
    expect(harness.announce).toHaveBeenLastCalledWith('2 layers found at this location')
  })

  test('a single hit opens directly and announces loading only once', async () => {
    const selected = hit('Grid square')
    useSources(sourceWith([selected]))

    await inspectAt()

    expect(selected.select).toHaveBeenCalled()
    expect(selected.loadDetails).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) })
    expect(harness.state.inspection).toMatchObject({
      status: 'detail-ready',
      hit: { id: 0, label: 'Grid square', details: { label: 'Grid square' } }
    })
    expect(Object.values(harness.state.inspection.hit)).not.toContainEqual(expect.any(Function))
    expect(harness.inspection.renderHit(harness.state.inspection.hit)).toBeNull()
    expect(selected.render).toHaveBeenCalledWith({ label: 'Grid square' })
    expect(harness.announce.mock.calls.filter(([message]) => message === 'Loading details')).toHaveLength(1)
  })

  test('uses details cached in reducer state without loading them again', async () => {
    const selected = hit('Grid square')
    useSources(sourceWith([selected, hit('OS feature')]))

    await inspectAt()
    await harness.inspection.selectHit(harness.state.inspection.hits[0])
    harness.inspection.showHitList()
    await harness.inspection.selectHit(harness.state.inspection.hits[0])

    expect(selected.loadDetails).toHaveBeenCalledTimes(1)
    expect(harness.state.inspection.hit.details).toEqual({ label: 'Grid square' })
  })

  test('one failing source does not suppress another source', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const failed = sourceWith(async () => { throw new Error('broken source') })
    const successful = sourceWith([hit('Grid square'), hit('OS feature')])
    useSources(failed, successful)

    await inspectAt()

    expect(harness.state.inspection.hits).toHaveLength(2)
    expect(console.error).toHaveBeenCalledWith('Hit source failed', expect.any(Error))
  })

  test('a second click supersedes an unresolved first click', async () => {
    let resolveFirst
    const firstResult = new Promise(resolve => { resolveFirst = resolve })
    const oldHit = hit('Old')
    const newHit = hit('New')
    const source = sourceWith(vi.fn()
      .mockReturnValueOnce(firstResult)
      .mockResolvedValueOnce([newHit]))
    useSources(source)

    const first = inspectAt([1, 2])
    const second = inspectAt([3, 4])
    await second
    resolveFirst([oldHit])
    await first

    expect(harness.state.inspection.hit.label).toBe('New')
    expect(oldHit.select).not.toHaveBeenCalled()
  })

  test('a hit that becomes unavailable while its source resolves is discarded', async () => {
    let resolveHits
    const pendingHits = new Promise(resolve => { resolveHits = resolve })
    const unavailable = hit('No longer visible')
    const source = sourceWith(() => pendingHits)
    useSources(source)

    const click = inspectAt()
    unavailable.stillValid.mockReturnValue(false)
    resolveHits([unavailable])
    await click

    expect(harness.state.inspection.status).toBe('empty')
  })

  test('a newer selected hit rejects stale detail completion', async () => {
    let resolveOld
    const oldDetails = new Promise(resolve => { resolveOld = resolve })
    const oldHit = hit('Old', { loadDetails: vi.fn(() => oldDetails) })
    const newHit = hit('New')
    useSources(sourceWith([oldHit, newHit]))
    await inspectAt()
    const oldStateHit = harness.state.inspection.hits.find(candidate => candidate.label === 'Old')
    const newStateHit = harness.state.inspection.hits.find(candidate => candidate.label === 'New')

    const oldRequest = harness.inspection.selectHit(oldStateHit)
    await harness.inspection.selectHit(newStateHit)
    resolveOld({ stale: true })
    await oldRequest

    expect(harness.state.inspection.hit.label).toBe('New')
    expect(harness.state.inspection.hit.details).toEqual({ label: 'New' })
  })

  test('Back cancels detail work, clears selection and restores the list', async () => {
    const hits = [hit('Grid square'), hit('OS feature')]
    useSources(sourceWith(hits))
    await inspectAt()
    await harness.inspection.selectHit(harness.state.inspection.hits[0])

    harness.inspection.showHitList()

    expect(harness.state.inspection).toMatchObject({ status: 'list', hit: null })
    expect(harness.announce).toHaveBeenLastCalledWith('2 layers selected')
  })

  test('retains a valid selected hit while pruning another hit', async () => {
    const retained = hit('Grid square')
    const removed = hit('OS feature')
    useSources(sourceWith([retained, removed]))
    await inspectAt()
    await harness.inspection.selectHit(harness.state.inspection.hits[0])
    removed.stillValid.mockReturnValue(false)

    harness.inspection.reconcile()

    expect(harness.state.inspection.hit.label).toBe('Grid square')
    expect(harness.state.inspection.hits).toHaveLength(1)
  })

  test('closes the panel when no hits remain', async () => {
    const selected = hit('Selected dataset')
    useSources(sourceWith([selected]))
    await inspectAt()
    const removedHit = harness.state.inspection.hit
    selected.stillValid.mockReturnValue(false)

    harness.inspection.reconcile()

    expect(harness.appDispatch).toHaveBeenLastCalledWith({ type: 'CLOSE_PANEL', payload: 'gepInfoPanel' })
    expect(harness.inspection.renderHit(removedHit)).toBeNull()
    const dispatchCount = harness.pluginDispatch.mock.calls.length
    await harness.inspection.selectHit(removedHit)
    expect(harness.pluginDispatch).toHaveBeenCalledTimes(dispatchCount)
  })

  test('when the selected hit disappears, a sole remaining hit opens automatically', async () => {
    const removed = hit('Grid square')
    const remaining = hit('OS feature')
    useSources(sourceWith([removed, remaining]))
    await inspectAt()
    await harness.inspection.selectHit(harness.state.inspection.hits[0])
    removed.stillValid.mockReturnValue(false)

    harness.inspection.reconcile()

    await vi.waitFor(() => expect(harness.state.inspection.hit.label).toBe('OS feature'))
  })

  test('announces when reconciliation restores a list of hits', async () => {
    const removed = hit('Grid square')
    const remaining = [hit('OS feature'), hit('Selected dataset')]
    useSources(sourceWith([removed, ...remaining]))
    await inspectAt()
    const removedHit = harness.state.inspection.hits.find(candidate => candidate.label === 'Grid square')
    await harness.inspection.selectHit(removedHit)
    removed.stillValid.mockReturnValue(false)

    harness.inspection.reconcile()

    expect(harness.state.inspection).toMatchObject({ status: 'list', hit: null })
    expect(harness.state.inspection.hits.map(candidate => candidate.label)).toEqual(['OS feature', 'Selected dataset'])
    expect(harness.announce).toHaveBeenLastCalledWith('2 layers selected')
  })

  test('panel closure cancels work, clears selections and resets inspection only', async () => {
    const source = sourceWith([hit('Grid square'), hit('OS feature')])
    useSources(source)
    await inspectAt()

    harness.eventBus.handlers['app:panelclosed']({ panelId: 'gepInfoPanel' })

    expect(harness.state.inspection).toMatchObject({ status: 'idle', hits: [], hit: null })
    expect(harness.state.datasets).toBe(initialState.datasets)
    expect(source.clearSelection).toHaveBeenCalled()
  })
})
