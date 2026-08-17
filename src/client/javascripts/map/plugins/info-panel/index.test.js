// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('@defra/interactive-map', () => ({
  EVENTS: {
    APP_PANEL_CLOSED: 'app:panelclosed'
  }
}))

vi.mock('../../pointer.js', () => ({
  isCoarsePointer: vi.fn(() => false)
}))

const { isCoarsePointer } = await import('../../pointer.js')
const { registerInfoPanel } = await import('./index.js')

function createMapHarness () {
  const handlers = {}
  return {
    addPanel: vi.fn(),
    showPanel: vi.fn(),
    hidePanel: vi.fn(),
    on: vi.fn((event, handler) => { handlers[event] = handler }),
    _handlers: handlers
  }
}

function createHit (overrides = {}) {
  return {
    label: 'Test layer',
    select: vi.fn(),
    loadDetails: vi.fn(async () => ({ detail: 'value' })),
    renderHtml: vi.fn(() => '<p>rendered</p>'),
    ...overrides
  }
}

function createSource (overrides = {}) {
  return {
    getHits: vi.fn(() => []),
    clearSelection: vi.fn(),
    ...overrides
  }
}

describe('#registerInfoPanel', () => {
  let interactiveMap
  let olMap

  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = '<div class="app-map"><div id="map-container"></div><div class="im-c-panel"><h2 class="im-c-panel__heading">Land model attributes</h2><div id="gep-info-status" class="govuk-visually-hidden" role="status"></div><div id="gep-info-content"></div></div></div>'
    interactiveMap = createMapHarness()
    const olHandlers = {}
    olMap = {
      getTargetElement: vi.fn(() => document.getElementById('map-container')),
      getView: vi.fn(() => ({ animate: vi.fn() })),
      on: vi.fn((event, handler) => { olHandlers[event] = handler }),
      _handlers: olHandlers
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  function contentEl () {
    return document.getElementById('gep-info-content')
  }

  function statusText () {
    return document.getElementById('gep-info-status').textContent
  }

  function panelTitle () {
    return document.querySelector('.im-c-panel__heading').textContent
  }

  function appMap () {
    return document.querySelector('.app-map')
  }

  async function click (coordinate = [418700, 385100]) {
    olMap._handlers.singleclick({ coordinate })
    await vi.advanceTimersByTimeAsync(0)
  }

  test('registers the panel with the shared shell', () => {
    registerInfoPanel(interactiveMap, olMap)

    expect(interactiveMap.addPanel).toHaveBeenCalledWith(
      'gep-info',
      expect.objectContaining({
        id: 'gep-info',
        label: 'Land model attributes',
        html: expect.stringContaining('id="gep-info-content"'),
        tablet: expect.objectContaining({ slot: 'right-top', modal: false }),
        desktop: expect.objectContaining({ slot: 'right-top', modal: false })
      })
    )
  })

  test('click with no active sources does nothing', async () => {
    registerInfoPanel(interactiveMap, olMap)

    await click()

    expect(interactiveMap.showPanel).not.toHaveBeenCalled()
    expect(contentEl().innerHTML).toBe('')
  })

  test('a single hit opens the panel, highlights it and renders its details', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    const hit = createHit()
    panel.activate(createSource({ getHits: vi.fn(() => [hit]) }))

    await click()

    expect(interactiveMap.showPanel).toHaveBeenCalledWith('gep-info', { focus: false })
    expect(appMap().classList.contains('app-map--info-panel-open')).toBe(true)
    expect(hit.select).toHaveBeenCalled()
    expect(hit.renderHtml).toHaveBeenCalledWith({ detail: 'value' })
    expect(contentEl().innerHTML).toBe('<p>rendered</p>')
  })

  test('a single hit shows no back link', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    panel.activate(createSource({ getHits: vi.fn(() => [createHit()]) }))

    await click()

    expect(contentEl().querySelector('[data-app-hit-back]')).toBeNull()
  })

  test('several hits render a list ordered by label', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    panel.activate(createSource({ getHits: vi.fn(() => [createHit({ label: 'Grid square' })]) }))
    panel.activate(createSource({ getHits: vi.fn(() => [createHit({ label: 'Ancient Woodland' })]) }))

    await click()

    const labels = [...contentEl().querySelectorAll('[data-app-hit-index]')].map(el => el.textContent.trim())
    expect(labels).toEqual(['Ancient Woodland', 'Grid square'])
    expect(panelTitle()).toBe('2 layers selected')
    expect(contentEl().textContent).toContain('More than one feature is at this location')
  })

  test('hits are not highlighted until one is picked from the list', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    const first = createHit({ label: 'First' })
    const second = createHit({ label: 'Second' })
    panel.activate(createSource({ getHits: vi.fn(() => [first, second]) }))

    await click()

    expect(first.select).not.toHaveBeenCalled()
    expect(second.select).not.toHaveBeenCalled()
  })

  test('picking a hit from the list shows its details with a back link', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    const first = createHit({ label: 'First', renderHtml: vi.fn(() => '<p>first details</p>') })
    panel.activate(createSource({ getHits: vi.fn(() => [first, createHit({ label: 'Second' })]) }))
    await click()

    contentEl().querySelector('[data-app-hit-index="0"]').click()

    await vi.waitFor(() => {
      expect(contentEl().innerHTML).toContain('first details')
    })
    expect(first.select).toHaveBeenCalled()
    expect(panelTitle()).toBe('Land model attributes')
    expect(contentEl().querySelector('[data-app-hit-back]').textContent).toContain('Back to 2 selected')
  })

  test('a hit with a panel title shows it while its details are open', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    const hit = createHit({ panelTitle: 'Data layer attributes' })
    panel.activate(createSource({ getHits: vi.fn(() => [hit]) }))

    await click()

    expect(panelTitle()).toBe('Data layer attributes')
  })

  test('the back link returns to the list and clears selections', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    const source = createSource({ getHits: vi.fn(() => [createHit({ label: 'First' }), createHit({ label: 'Second' })]) })
    panel.activate(source)
    await click()
    contentEl().querySelector('[data-app-hit-index="0"]').click()
    await vi.waitFor(() => {
      expect(contentEl().querySelector('[data-app-hit-back]')).not.toBeNull()
    })
    source.clearSelection.mockClear()

    contentEl().querySelector('[data-app-hit-back]').click()

    expect(source.clearSelection).toHaveBeenCalled()
    expect(panelTitle()).toBe('2 layers selected')
    expect(contentEl().querySelectorAll('[data-app-hit-index]')).toHaveLength(2)
  })

  test('revisiting a hit reuses its loaded details', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    const first = createHit({ label: 'First' })
    panel.activate(createSource({ getHits: vi.fn(() => [first, createHit({ label: 'Second' })]) }))
    await click()

    contentEl().querySelector('[data-app-hit-index="0"]').click()
    await vi.waitFor(() => {
      expect(contentEl().querySelector('[data-app-hit-back]')).not.toBeNull()
    })
    contentEl().querySelector('[data-app-hit-back]').click()
    contentEl().querySelector('[data-app-hit-index="0"]').click()
    await vi.waitFor(() => {
      expect(contentEl().querySelector('[data-app-hit-back]')).not.toBeNull()
    })

    expect(first.loadDetails).toHaveBeenCalledTimes(1)
  })

  test('click with no hits keeps the panel open and shows the empty state', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    const source = createSource({ getHits: vi.fn(() => [createHit()]) })
    panel.activate(source)
    await click()

    source.getHits.mockReturnValue([])
    await click()

    expect(source.clearSelection).toHaveBeenCalled()
    expect(interactiveMap.hidePanel).not.toHaveBeenCalled()
    expect(contentEl().textContent).toContain('No information found at this location')
  })

  test('click with no hits and the panel closed does not open it', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    panel.activate(createSource())

    await click()

    expect(interactiveMap.showPanel).not.toHaveBeenCalled()
    expect(contentEl().innerHTML).toBe('')
  })

  test('a failing source does not break hits from the others', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const panel = registerInfoPanel(interactiveMap, olMap)
    panel.activate(createSource({ getHits: vi.fn(() => { throw new Error('source broke') }) }))
    panel.activate(createSource({ getHits: vi.fn(() => [createHit()]) }))

    await click()

    expect(contentEl().innerHTML).toBe('<p>rendered</p>')
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  test('a stale details response does not overwrite a newer selection', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    let resolveFirst
    const hitFactory = vi.fn()
      .mockImplementationOnce(() => [createHit({
        loadDetails: vi.fn(() => new Promise((resolve) => { resolveFirst = resolve })),
        renderHtml: vi.fn((details) => `<p>${details.id}</p>`)
      })])
      .mockImplementationOnce(() => [createHit({
        loadDetails: vi.fn(async () => ({ id: 'second' })),
        renderHtml: vi.fn((details) => `<p>${details.id}</p>`)
      })])
    panel.activate(createSource({ getHits: hitFactory }))

    await click()
    expect(typeof resolveFirst).toBe('function')
    await click()
    resolveFirst({ id: 'first' })
    await vi.advanceTimersByTimeAsync(0)

    expect(contentEl().innerHTML).toBe('<p>second</p>')
  })

  test('getHits receives an abort signal that a newer click aborts', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    const source = createSource()
    panel.activate(source)

    await click()
    const { signal } = source.getHits.mock.calls[0][1]
    expect(signal.aborted).toBe(false)

    await click()
    expect(signal.aborted).toBe(true)
  })

  test('fine pointers identify on singleclick so double-click stays clean', () => {
    registerInfoPanel(interactiveMap, olMap)

    expect(olMap.on).toHaveBeenCalledWith('singleclick', expect.any(Function))
  })

  test('coarse pointers identify on plain click without the singleclick delay', () => {
    isCoarsePointer.mockReturnValueOnce(true)

    registerInfoPanel(interactiveMap, olMap)

    expect(olMap.on).toHaveBeenCalledWith('click', expect.any(Function))
  })

  test('going back while details are loading aborts the stale load', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    let resolveDetails
    const slow = createHit({
      label: 'First',
      loadDetails: vi.fn(() => new Promise((resolve) => { resolveDetails = resolve })),
      renderHtml: vi.fn(() => '<p>first details</p>')
    })
    panel.activate(createSource({ getHits: vi.fn(() => [slow, createHit({ label: 'Second' })]) }))
    await click()

    contentEl().querySelector('[data-app-hit-index="0"]').click()
    const { signal } = slow.loadDetails.mock.calls[0][0]

    contentEl().querySelector('[data-app-hit-back]').click()
    expect(signal.aborted).toBe(true)

    resolveDetails({ id: 'first' })
    await vi.advanceTimersByTimeAsync(0)

    expect(panelTitle()).toBe('2 layers selected')
    expect(contentEl().querySelectorAll('[data-app-hit-index]')).toHaveLength(2)
  })

  test('hits from a source deactivated during collection are dropped', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    let resolveHits
    const source = createSource({
      getHits: vi.fn(() => new Promise((resolve) => { resolveHits = resolve }))
    })
    panel.activate(source)
    await click()

    panel.deactivate(source)
    resolveHits([createHit()])
    await vi.advanceTimersByTimeAsync(0)

    expect(interactiveMap.showPanel).not.toHaveBeenCalled()
    expect(contentEl().innerHTML).toBe('')
  })

  test('a failed details load shows the error state', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const panel = registerInfoPanel(interactiveMap, olMap)
    const hit = createHit({
      loadDetails: vi.fn(async () => { throw new Error('request failed') })
    })
    panel.activate(createSource({ getHits: vi.fn(() => [hit]) }))

    await click()

    expect(hit.renderHtml).not.toHaveBeenCalled()
    expect(contentEl().textContent).toContain('Could not load details')
    expect(appMap().classList.contains('app-map--info-panel-open')).toBe(true)
    consoleError.mockRestore()
  })

  test('panel close clears selections and the layout class', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    const source = createSource({ getHits: vi.fn(() => [createHit()]) })
    panel.activate(source)
    await click()

    interactiveMap._handlers['app:panelclosed']({ panelId: 'gep-info' })

    expect(source.clearSelection).toHaveBeenCalled()
    expect(appMap().classList.contains('app-map--info-panel-open')).toBe(false)
  })

  test('other panel close events are ignored', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    const source = createSource({ getHits: vi.fn(() => [createHit()]) })
    panel.activate(source)
    await click()
    source.clearSelection.mockClear()

    interactiveMap._handlers['app:panelclosed']({ panelId: 'some-other-panel' })

    expect(source.clearSelection).not.toHaveBeenCalled()
    expect(appMap().classList.contains('app-map--info-panel-open')).toBe(true)
  })

  test('deactivating the source behind the current content closes the panel', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    const source = createSource({ getHits: vi.fn(() => [createHit()]) })
    panel.activate(source)
    await click()

    panel.deactivate(source)

    expect(interactiveMap.hidePanel).toHaveBeenCalledWith('gep-info')
    expect(appMap().classList.contains('app-map--info-panel-open')).toBe(false)

    await click()
    expect(interactiveMap.showPanel).toHaveBeenCalledTimes(1)
  })

  test('deactivating an unrelated source leaves the panel open', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    const withHits = createSource({ getHits: vi.fn(() => [createHit()]) })
    const without = createSource()
    panel.activate(withHits)
    panel.activate(without)
    await click()

    panel.deactivate(without)

    expect(interactiveMap.hidePanel).not.toHaveBeenCalled()
    expect(appMap().classList.contains('app-map--info-panel-open')).toBe(true)
  })

  test('deactivating a source that is not active is a no-op', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    panel.activate(createSource({ getHits: vi.fn(() => [createHit()]) }))
    await click()

    panel.deactivate(createSource())

    expect(interactiveMap.hidePanel).not.toHaveBeenCalled()
    expect(appMap().classList.contains('app-map--info-panel-open')).toBe(true)
  })

  test('refreshHits drops a hit whose layer is no longer shown', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    let secondShown = true
    const first = createHit({ label: 'First', renderHtml: vi.fn(() => '<p>first details</p>') })
    const second = createHit({ label: 'Second', stillValid: () => secondShown })
    panel.activate(createSource({ getHits: vi.fn(() => [first, second]) }))
    await click()
    expect(contentEl().querySelectorAll('[data-app-hit-index]')).toHaveLength(2)

    secondShown = false
    panel.refreshHits()

    await vi.waitFor(() => {
      expect(contentEl().innerHTML).toContain('first details')
    })
    expect(contentEl().querySelector('[data-app-hit-back]')).toBeNull()
  })

  test('refreshHits closes the panel when nothing under the click remains shown', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    let shown = true
    const source = createSource({ getHits: vi.fn(() => [createHit({ stillValid: () => shown })]) })
    panel.activate(source)
    await click()

    shown = false
    panel.refreshHits()

    expect(interactiveMap.hidePanel).toHaveBeenCalledWith('gep-info')
    expect(source.clearSelection).toHaveBeenCalled()
  })

  test('a layer unchecked while details load corrects the back count when they land', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    let resolveDetails
    let thirdShown = true
    const slow = createHit({
      label: 'First',
      loadDetails: vi.fn(() => new Promise((resolve) => { resolveDetails = resolve })),
      renderHtml: vi.fn(() => '<p>first details</p>')
    })
    panel.activate(createSource({
      getHits: vi.fn(() => [
        slow,
        createHit({ label: 'Second' }),
        createHit({ label: 'Third', stillValid: () => thirdShown })
      ])
    }))
    await click()
    contentEl().querySelector('[data-app-hit-index="0"]').click()
    expect(contentEl().textContent).toContain('Back to 3 selected')

    thirdShown = false
    panel.refreshHits()
    expect(contentEl().textContent).toContain('Loading details')
    expect(contentEl().textContent).toContain('Back to 2 selected')

    resolveDetails({ detail: 'value' })
    await vi.advanceTimersByTimeAsync(0)

    expect(contentEl().innerHTML).toContain('first details')
    expect(contentEl().textContent).toContain('Back to 2 selected')
  })

  test('a loading hit pruned from the list cannot overwrite it when it resolves', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    let resolveDetails
    let firstShown = true
    const slow = createHit({
      label: 'First',
      stillValid: () => firstShown,
      loadDetails: vi.fn(() => new Promise((resolve) => { resolveDetails = resolve })),
      renderHtml: vi.fn(() => '<p>first details</p>')
    })
    panel.activate(createSource({
      getHits: vi.fn(() => [
        slow,
        createHit({ label: 'Second' }),
        createHit({ label: 'Third' })
      ])
    }))
    await click()
    contentEl().querySelector('[data-app-hit-index="0"]').click()
    expect(contentEl().textContent).toContain('Loading details')

    firstShown = false
    panel.refreshHits()
    expect(contentEl().textContent).toContain('Second')

    resolveDetails({ detail: 'value' })
    await vi.advanceTimersByTimeAsync(0)

    expect(contentEl().innerHTML).not.toContain('first details')
    expect(contentEl().textContent).toContain('Second')
  })

  test('refreshHits updates the back count on an open detail view', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    let thirdShown = true
    panel.activate(createSource({
      getHits: vi.fn(() => [
        createHit({ label: 'First' }),
        createHit({ label: 'Second' }),
        createHit({ label: 'Third', stillValid: () => thirdShown })
      ])
    }))
    await click()
    contentEl().querySelector('[data-app-hit-index="0"]').click()
    await vi.waitFor(() => {
      expect(contentEl().textContent).toContain('Back to 3 selected')
    })

    thirdShown = false
    panel.refreshHits()

    expect(contentEl().textContent).toContain('Back to 2 selected')
  })

  test('preserves which sections are expanded across content updates', async () => {
    const sectionHtml = `
      <details class="app-map__info-section">
        <summary class="app-map__info-section-heading">
          <span class="app-map__info-section-title">Land cover</span>
        </summary>
        <div>content</div>
      </details>
      <details class="app-map__info-section">
        <summary class="app-map__info-section-heading">
          <span class="app-map__info-section-title">Topography</span>
        </summary>
        <div>content</div>
      </details>
    `
    const panel = registerInfoPanel(interactiveMap, olMap)
    panel.activate(createSource({
      getHits: vi.fn(() => [createHit({ renderHtml: vi.fn(() => sectionHtml) })])
    }))

    await click()
    contentEl().querySelectorAll('.app-map__info-section')[0].open = true

    await click()
    const sections = contentEl().querySelectorAll('.app-map__info-section')

    expect(sections[0].open).toBe(true)
    expect(sections[1].open).toBe(false)
  })

  test('announces the details once they are loaded', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    panel.activate(createSource({ getHits: vi.fn(() => [createHit({ label: 'Ancient Woodland' })]) }))

    await click()

    expect(statusText()).toBe('Ancient Woodland details loaded')
  })

  test('announces how many layers are under the click', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    panel.activate(createSource({
      getHits: vi.fn(() => [createHit({ label: 'Peat' }), createHit({ label: 'Woodland' })])
    }))

    await click()

    expect(statusText()).toBe('2 layers found at this location')
  })

  test('announces a click that finds nothing', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    panel.activate(createSource())

    await click()

    expect(statusText()).toBe('No information found at this location')
  })

  test('announces a failed details load', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const panel = registerInfoPanel(interactiveMap, olMap)
    panel.activate(createSource({
      getHits: vi.fn(() => [createHit({ loadDetails: vi.fn(async () => { throw new Error('request failed') }) })])
    }))

    await click()

    expect(statusText()).toBe('Could not load details')
    consoleError.mockRestore()
  })

  test('marks the content busy while details load', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    let resolveDetails
    panel.activate(createSource({
      getHits: vi.fn(() => [createHit({
        loadDetails: vi.fn(() => new Promise(resolve => { resolveDetails = resolve }))
      })])
    }))

    await click()
    expect(contentEl().getAttribute('aria-busy')).toBe('true')
    expect(statusText()).toBe('Loading details')

    resolveDetails({ detail: 'value' })
    await vi.advanceTimersByTimeAsync(0)

    expect(contentEl().hasAttribute('aria-busy')).toBe(false)
  })

  test('clicking the sample area link jumps the map to the sample area', async () => {
    const mockSetCenter = vi.fn()
    const mockSetZoom = vi.fn()
    olMap.getView.mockReturnValue({ setCenter: mockSetCenter, setZoom: mockSetZoom })
    const panel = registerInfoPanel(interactiveMap, olMap)
    const unavailableHtml = '<div class="app-map__info-content"><a href="#" class="app-link-button app-map__info-sample-link">Go to the sample area</a></div>'
    panel.activate(createSource({
      getHits: vi.fn(() => [createHit({ renderHtml: vi.fn(() => unavailableHtml) })])
    }))

    await click()
    contentEl().querySelector('.app-map__info-sample-link').click()

    expect(mockSetCenter).toHaveBeenCalledWith([465000, 475000])
    expect(mockSetZoom).toHaveBeenCalledWith(11)
  })
})
