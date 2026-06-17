// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('@defra/interactive-map', () => ({
  EVENTS: {
    MAP_CLICK: 'map:click',
    APP_PANEL_CLOSED: 'app:panelclosed'
  }
}))

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

function createInspector (overrides = {}) {
  return {
    emptyHtml: '<p>empty state</p>',
    hitTest: vi.fn(() => ({ id: 'hit-1' })),
    loadDetails: vi.fn(async () => ({ detail: 'value' })),
    renderHtml: vi.fn(() => '<p>rendered</p>'),
    clearSelection: vi.fn(),
    ...overrides
  }
}

describe('#registerInfoPanel', () => {
  let interactiveMap
  let olMap

  beforeEach(() => {
    document.body.innerHTML = '<div class="app-map"><div id="map-container"></div><div id="gep-info-content"></div></div>'
    interactiveMap = createMapHarness()
    olMap = {
      getTargetElement: vi.fn(() => document.getElementById('map-container'))
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  function contentEl () {
    return document.getElementById('gep-info-content')
  }

  function appMap () {
    return document.querySelector('.app-map')
  }

  function click (coords = [418700, 385100]) {
    return interactiveMap._handlers['map:click']({ coords })
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

  test('click with no active inspector does nothing', async () => {
    registerInfoPanel(interactiveMap, olMap)

    await click()

    expect(interactiveMap.showPanel).not.toHaveBeenCalled()
    expect(contentEl().innerHTML).toBe('')
  })

  test('click on a hit opens the panel with a loading state then the rendered content', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    let resolveDetails
    const inspector = createInspector({
      loadDetails: vi.fn(() => new Promise((resolve) => { resolveDetails = resolve }))
    })
    panel.activate(inspector)

    const pending = click()
    expect(contentEl().textContent).toContain('Loading details')
    expect(interactiveMap.showPanel).toHaveBeenCalledWith('gep-info', { focus: false })
    expect(appMap().classList.contains('app-map--info-panel-open')).toBe(true)

    resolveDetails({ detail: 'value' })
    await pending

    expect(inspector.renderHtml).toHaveBeenCalledWith({ id: 'hit-1' }, { detail: 'value' })
    expect(contentEl().innerHTML).toBe('<p>rendered</p>')
  })

  test('click on a miss keeps the panel open and shows the empty state', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    const inspector = createInspector()
    panel.activate(inspector)
    await click()

    inspector.hitTest.mockReturnValue(null)
    await click()

    expect(inspector.clearSelection).toHaveBeenCalled()
    expect(interactiveMap.hidePanel).not.toHaveBeenCalled()
    expect(contentEl().innerHTML).toBe('<p>empty state</p>')
  })

  test('click on a miss with the panel closed does not open it', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    const inspector = createInspector({ hitTest: vi.fn(() => null) })
    panel.activate(inspector)

    await click()

    expect(interactiveMap.showPanel).not.toHaveBeenCalled()
    expect(contentEl().innerHTML).toBe('')
  })

  test('a stale details response does not overwrite a newer selection', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    let resolveFirst
    const inspector = createInspector()
    inspector.loadDetails
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockImplementationOnce(async () => ({ id: 'second' }))
    inspector.renderHtml.mockImplementation((hit, details) => `<p>${details.id}</p>`)
    panel.activate(inspector)

    const first = click()
    const second = click()
    await second
    resolveFirst({ id: 'first' })
    await first

    expect(contentEl().innerHTML).toBe('<p>second</p>')
  })

  test('loadDetails receives an abort signal that a newer click aborts', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    const inspector = createInspector()
    panel.activate(inspector)

    const first = click()
    const { signal } = inspector.loadDetails.mock.calls[0][1]
    expect(signal.aborted).toBe(false)

    const second = click()
    expect(signal.aborted).toBe(true)
    await Promise.all([first, second])
  })

  test('a click on a miss invalidates a pending details load', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    let resolveFirst
    const inspector = createInspector()
    inspector.loadDetails.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
    panel.activate(inspector)

    const first = click()
    inspector.hitTest.mockReturnValue(null)
    await click()

    resolveFirst({ detail: 'late' })
    await first

    expect(inspector.renderHtml).not.toHaveBeenCalled()
    expect(contentEl().innerHTML).toBe('<p>empty state</p>')
  })

  test('a failed details load shows the error state', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    const inspector = createInspector({
      loadDetails: vi.fn(async () => { throw new Error('request failed') })
    })
    panel.activate(inspector)

    await click()

    expect(inspector.renderHtml).not.toHaveBeenCalled()
    expect(contentEl().textContent).toContain('Could not load details')
    expect(appMap().classList.contains('app-map--info-panel-open')).toBe(true)
  })

  test('a stale failed load does not overwrite a newer selection', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    let rejectFirst
    const inspector = createInspector()
    inspector.loadDetails
      .mockImplementationOnce(() => new Promise((resolve, reject) => { rejectFirst = reject }))
      .mockImplementationOnce(async () => ({ id: 'second' }))
    inspector.renderHtml.mockImplementation((hit, details) => `<p>${details.id}</p>`)
    panel.activate(inspector)

    const first = click()
    const second = click()
    await second
    rejectFirst(new Error('request failed'))
    await first

    expect(contentEl().innerHTML).toBe('<p>second</p>')
  })

  test('panel close clears the selection and the layout class', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    const inspector = createInspector()
    panel.activate(inspector)
    await click()

    interactiveMap._handlers['app:panelclosed']({ panelId: 'gep-info' })

    expect(inspector.clearSelection).toHaveBeenCalled()
    expect(appMap().classList.contains('app-map--info-panel-open')).toBe(false)
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
    const inspector = createInspector({ renderHtml: vi.fn(() => sectionHtml) })
    panel.activate(inspector)

    await click()
    contentEl().querySelectorAll('.app-map__info-section')[0].open = true

    await click()
    const sections = contentEl().querySelectorAll('.app-map__info-section')

    expect(sections[0].open).toBe(true)
    expect(sections[1].open).toBe(false)
  })

  test('other panel close events are ignored', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    const inspector = createInspector()
    panel.activate(inspector)
    await click()

    interactiveMap._handlers['app:panelclosed']({ panelId: 'some-other-panel' })

    expect(inspector.clearSelection).not.toHaveBeenCalled()
    expect(appMap().classList.contains('app-map--info-panel-open')).toBe(true)
  })

  test('deactivate closes the panel and ignores further clicks', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    const inspector = createInspector()
    panel.activate(inspector)
    await click()

    panel.deactivate(inspector)

    expect(interactiveMap.hidePanel).toHaveBeenCalledWith('gep-info')
    expect(appMap().classList.contains('app-map--info-panel-open')).toBe(false)

    await click()
    expect(interactiveMap.showPanel).toHaveBeenCalledTimes(1)
  })

  test('deactivate by an inspector that is not active is a no-op', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    const active = createInspector()
    panel.activate(active)
    await click()

    panel.deactivate(createInspector())

    expect(interactiveMap.hidePanel).not.toHaveBeenCalled()
    expect(appMap().classList.contains('app-map--info-panel-open')).toBe(true)
  })

  test('a details response from a replaced inspector is discarded', async () => {
    const panel = registerInfoPanel(interactiveMap, olMap)
    let resolveDetails
    const replaced = createInspector({
      loadDetails: vi.fn(() => new Promise((resolve) => { resolveDetails = resolve }))
    })
    panel.activate(replaced)
    const pending = click()

    panel.activate(createInspector())
    resolveDetails({ detail: 'late' })
    await pending

    expect(replaced.renderHtml).not.toHaveBeenCalled()
  })
})
