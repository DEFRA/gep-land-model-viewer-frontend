// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('@defra/interactive-map', () => ({
  EVENTS: { APP_PANEL_CLOSED: 'app:panelclosed', APP_HIDE_PANEL: 'app:hidepanel' }
}))

const { createInspection } = await import('./index.js')
const { initialState, actions } = await import('../reducer.js')

function createMapHarness () {
  const handlers = {}
  const target = document.createElement('div')
  return {
    handlers,
    getTargetElement: () => target,
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
    }),
    emit: vi.fn()
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
  harness = makeHarness()
})

afterEach(() => {
  harness.inspection.dispose()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function useSources (...sources) {
  harness.inspection.dispose()
  harness = makeHarness(sources)
}

function inspectAt (coordinate = [1, 2]) {
  return harness.map.handlers.singleclick({ coordinate })
}

describe('#createInspection', () => {
  test('reconciliation cancels a pending search when the inspectable themes change', async () => {
    const request = Promise.withResolvers()
    const source = sourceWith(() => request.promise)
    useSources(source)
    const pending = inspectAt()
    const signal = source.getHits.mock.calls[0][1].signal

    harness.inspection.reconcile()
    expect(signal.aborted).toBe(true)
    request.resolve([hit('Old theme')])
    await pending

    expect(harness.state.inspection).toEqual({ status: 'idle', hits: [], hit: null, selection: null })
    expect(harness.appDispatch).not.toHaveBeenCalled()
  })

  test('owns map and panel-close listeners for its lifetime', () => {
    expect(harness.map.on).toHaveBeenCalledWith('singleclick', expect.any(Function))
    expect(harness.eventBus.on).toHaveBeenCalledWith('app:panelclosed', expect.any(Function))

    harness.inspection.dispose()

    expect(harness.map.un).toHaveBeenCalledWith('singleclick', expect.any(Function))
    expect(harness.eventBus.off).toHaveBeenCalledWith('app:panelclosed', expect.any(Function))
  })

  test('waits for singleclick before opening Info on touch screens', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    useSources(sourceWith([hit('Agricultural Land Classification (FGB)')]))

    await harness.map.handlers.click?.({ coordinate: [1, 2] })

    expect(harness.appDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'OPEN_PANEL' }))

    await inspectAt()

    expect(harness.appDispatch).toHaveBeenCalledWith({
      type: 'OPEN_PANEL',
      payload: { panelId: 'gepInfoPanel', focusOnOpen: false }
    })
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

    expect(harness.eventBus.emit).toHaveBeenCalledWith('app:hidepanel', 'gepInfoPanel')
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
    expect(harness.state.layers).toBe(initialState.layers)
    expect(source.clearSelection).toHaveBeenCalled()
  })
})

// x 0 has no square, any other x toggles that square
function selectableSource () {
  const selected = new Set()
  const selection = {
    toggleAt: vi.fn(([x]) => {
      if (!x) {
        return false
      }

      selected.has(x) ? selected.delete(x) : selected.add(x)
      return true
    }),
    isEmpty: () => !selected.size,
    title: () => 'Grid squares',
    label: () => `${selected.size} grid squares selected`,
    stillValid: vi.fn(() => true),
    loadDetails: vi.fn(async () => ({ count: selected.size })),
    render: vi.fn(details => details)
  }

  return {
    selection,
    getHits: vi.fn(async () => []),
    clearSelection: vi.fn(() => selected.clear())
  }
}

function shiftClickAt (coordinate = [1, 2]) {
  return harness.map.handlers.singleclick({ coordinate, originalEvent: { shiftKey: true } })
}

function pressEscape () {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
}

// Like the map viewport and its menus, which prevent Escape's default
function pressPreventedEscapeIn (element) {
  document.body.append(element)
  element.addEventListener('keydown', event => event.preventDefault())
  element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  element.remove()
}

describe('Shift + click selection', () => {
  let source
  let datasets

  beforeEach(() => {
    source = selectableSource()
    datasets = sourceWith([hit('Ancient Woodland')])
    useSources(datasets, source)
  })

  test('shows the selection in the panel without asking sources for hits', async () => {
    await shiftClickAt([1])
    await shiftClickAt([2])

    expect(source.getHits).not.toHaveBeenCalled()
    expect(datasets.getHits).not.toHaveBeenCalled()
    expect(harness.appDispatch).toHaveBeenCalledWith({
      type: 'OPEN_PANEL',
      payload: { panelId: 'gepInfoPanel', focusOnOpen: false }
    })
    expect(harness.state.inspection.selection).toEqual({ title: 'Grid squares', details: { count: 2 } })
    expect(harness.announce.mock.calls.slice(-2)).toEqual([['2 grid squares selected'], ['2 grid squares selected, details loaded']])
  })

  test('starting a selection clears another source\'s highlight', async () => {
    await shiftClickAt([1])

    expect(datasets.clearSelection).toHaveBeenCalled()
  })

  test('a newer change supersedes an unfinished load', async () => {
    const first = Promise.withResolvers()
    source.selection.loadDetails.mockReturnValueOnce(first.promise)
    const pending = shiftClickAt([1])
    await shiftClickAt([2])

    first.resolve({ count: 1 })
    await pending

    expect(harness.state.inspection.selection.details).toEqual({ count: 2 })
  })

  test('reports a failed load', async () => {
    source.selection.loadDetails.mockRejectedValueOnce(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await shiftClickAt([1])

    expect(harness.state.inspection.status).toBe('detail-error')
    expect(harness.announce).toHaveBeenLastCalledWith('Could not load details')
  })

  test('emptying the selection clears it and closes the panel', async () => {
    await shiftClickAt([1])

    await shiftClickAt([1])

    expect(harness.eventBus.emit).toHaveBeenCalledWith('app:hidepanel', 'gepInfoPanel')
    expect(harness.announce).toHaveBeenLastCalledWith('Selection cleared')
  })

  test('does nothing with no unit under the pointer', async () => {
    await shiftClickAt([1])
    harness.appDispatch.mockClear()

    await shiftClickAt([0])

    expect(harness.appDispatch).not.toHaveBeenCalled()
    expect(harness.state.inspection.status).toBe('detail-ready')
  })

  test('a plain click clears the selection', async () => {
    await shiftClickAt([1])

    await inspectAt()

    expect(source.selection.isEmpty()).toBe(true)
    expect(harness.state.inspection.selection).toBeNull()
  })

  test('closes the panel without announcement when the selection is no longer valid', async () => {
    await shiftClickAt([1])
    harness.announce.mockClear()
    source.selection.stillValid.mockReturnValue(false)

    harness.inspection.reconcile()

    expect(harness.eventBus.emit).toHaveBeenCalledWith('app:hidepanel', 'gepInfoPanel')
    expect(source.selection.isEmpty()).toBe(true)
    expect(harness.announce).not.toHaveBeenCalled()
  })

  test('reconciling keeps a selection that is still valid', async () => {
    await shiftClickAt([1])

    harness.inspection.reconcile()

    expect(harness.eventBus.emit).not.toHaveBeenCalled()
    expect(harness.state.inspection.status).toBe('detail-ready')
  })

  test('closing the panel clears the selection', async () => {
    await shiftClickAt([1])

    harness.eventBus.handlers['app:panelclosed']({ panelId: 'gepInfoPanel' })

    expect(source.selection.isEmpty()).toBe(true)
  })
})

describe('Escape', () => {
  let source
  let datasets

  beforeEach(() => {
    source = selectableSource()
    datasets = sourceWith([hit('Ancient Woodland')])
    useSources(datasets, source)
  })

  test('Escape clears the selection and closes the panel', async () => {
    await shiftClickAt([1])

    pressEscape()

    expect(harness.eventBus.emit).toHaveBeenCalledWith('app:hidepanel', 'gepInfoPanel')
    expect(source.selection.isEmpty()).toBe(true)
    expect(harness.announce).toHaveBeenLastCalledWith('Selection cleared')
  })

  test('Escape from the map viewport clears the selection', async () => {
    await shiftClickAt([1])
    const viewport = document.createElement('div')
    viewport.append(harness.map.getTargetElement())

    pressPreventedEscapeIn(viewport)

    expect(source.selection.isEmpty()).toBe(true)
  })

  test('Escape closes a plain click\'s hit too', async () => {
    await inspectAt()

    pressEscape()

    expect(harness.eventBus.emit).toHaveBeenCalledWith('app:hidepanel', 'gepInfoPanel')
    expect(harness.announce).toHaveBeenLastCalledWith('Selection cleared')
  })

  test('Escape closes a list of hits without announcing a cleared selection', async () => {
    useSources(sourceWith([hit('Ancient Woodland'), hit('SSSI')]))
    await inspectAt()
    harness.announce.mockClear()

    pressEscape()

    expect(harness.eventBus.emit).toHaveBeenCalledWith('app:hidepanel', 'gepInfoPanel')
    expect(harness.announce).not.toHaveBeenCalled()
  })

  test('Escape in a field leaves the panel open', async () => {
    await shiftClickAt([1])
    const input = document.createElement('input')
    document.body.append(input)

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    input.remove()

    expect(harness.eventBus.emit).not.toHaveBeenCalled()
  })

  test('Escape closes the panel while a new click is still searching', async () => {
    await shiftClickAt([1])
    datasets.getHits.mockReturnValue(new Promise(() => {}))
    inspectAt()

    pressEscape()

    expect(harness.eventBus.emit).toHaveBeenCalledWith('app:hidepanel', 'gepInfoPanel')
  })

  test('Escape leaves keys handled by other controls alone', async () => {
    await shiftClickAt([1])

    pressPreventedEscapeIn(document.createElement('ul'))

    expect(harness.eventBus.emit).not.toHaveBeenCalled()
  })

  test('Escape does nothing when the panel is closed', () => {
    pressEscape()

    expect(harness.eventBus.emit).not.toHaveBeenCalled()
    expect(harness.announce).not.toHaveBeenCalled()
  })

  test('stops listening for Escape when disposed', async () => {
    await shiftClickAt([1])
    harness.inspection.dispose()

    pressEscape()

    expect(harness.eventBus.emit).not.toHaveBeenCalled()
  })
})
