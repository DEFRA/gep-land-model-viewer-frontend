// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('./grid-layer.js', () => ({
  createGridLayer: vi.fn()
}))

vi.mock('@defra/interactive-map', () => ({
  EVENTS: {
    MAP_CLICK: 'map:click',
    MAP_RENDER: 'map:render',
    APP_PANEL_CLOSED: 'app:panelclosed'
  }
}))

const { createGridLayer } = await import('./grid-layer.js')
const { registerGridPlugin } = await import('./index.js')

function createMapHarness () {
  const handlers = {}
  return {
    addButton: vi.fn(),
    addPanel: vi.fn(),
    showPanel: vi.fn(),
    toggleButtonState: vi.fn(),
    on: vi.fn((event, handler) => {
      handlers[event] = handler
    }),
    _handlers: handlers
  }
}

function createMockGridLayer () {
  return {
    setEnabled: vi.fn(),
    highlightCell: vi.fn(),
    clearHighlight: vi.fn(),
    isVisible: vi.fn(() => true),
    canShow: vi.fn(() => true)
  }
}

describe('#registerGridPlugin', () => {
  let interactiveMap
  let mockGridLayer
  const arcgisMap = {}
  const view = {}

  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = '<div id="gep-grid-info-content"></div>'
    interactiveMap = createMapHarness()
    mockGridLayer = createMockGridLayer()
    createGridLayer.mockReturnValue(mockGridLayer)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  test('creates grid layer on registration', async () => {
    await registerGridPlugin(interactiveMap, arcgisMap, view)

    expect(createGridLayer).toHaveBeenCalledWith(interactiveMap, arcgisMap, view)
  })

  test('adds toggle button with grid icon', async () => {
    await registerGridPlugin(interactiveMap, arcgisMap, view)

    expect(interactiveMap.addButton).toHaveBeenCalledWith(
      'gep-grid-toggle',
      expect.objectContaining({
        id: 'gep-grid-toggle',
        label: 'Toggle grid',
        isPressed: true
      })
    )
  })

  test('adds info panel for cell details', async () => {
    await registerGridPlugin(interactiveMap, arcgisMap, view)

    expect(interactiveMap.addPanel).toHaveBeenCalledWith(
      'gep-grid-info',
      expect.objectContaining({
        id: 'gep-grid-info',
        label: 'Cell info'
      })
    )
  })

  test('toggle button click toggles grid visibility', async () => {
    await registerGridPlugin(interactiveMap, arcgisMap, view)

    const buttonConfig = interactiveMap.addButton.mock.calls[0][1]
    buttonConfig.onClick()

    expect(mockGridLayer.setEnabled).toHaveBeenCalledWith(false)
    expect(interactiveMap.toggleButtonState).toHaveBeenCalledWith(
      'gep-grid-toggle',
      'pressed',
      false
    )

    buttonConfig.onClick()

    expect(mockGridLayer.setEnabled).toHaveBeenCalledWith(true)
  })

  test('map click shows cell info panel when grid visible', async () => {
    await registerGridPlugin(interactiveMap, arcgisMap, view)

    const clickHandler = interactiveMap._handlers['map:click']
    clickHandler({ coords: [418725, 385137] })

    vi.advanceTimersByTime(300)

    expect(mockGridLayer.highlightCell).toHaveBeenCalledWith(418720, 385130)
    expect(interactiveMap.showPanel).toHaveBeenCalledWith('gep-grid-info', { focus: false })
  })

  test('map click does nothing when grid not visible', async () => {
    mockGridLayer.isVisible.mockReturnValue(false)
    await registerGridPlugin(interactiveMap, arcgisMap, view)

    const clickHandler = interactiveMap._handlers['map:click']
    clickHandler({ coords: [418725, 385137] })

    vi.advanceTimersByTime(300)

    expect(mockGridLayer.highlightCell).not.toHaveBeenCalled()
  })

  test('double click is ignored', async () => {
    await registerGridPlugin(interactiveMap, arcgisMap, view)

    const clickHandler = interactiveMap._handlers['map:click']
    clickHandler({ coords: [418725, 385137] })
    clickHandler({ coords: [418725, 385137] })

    vi.advanceTimersByTime(300)

    expect(mockGridLayer.highlightCell).not.toHaveBeenCalled()
  })

  test('panel close clears cell highlight', async () => {
    await registerGridPlugin(interactiveMap, arcgisMap, view)

    const closeHandler = interactiveMap._handlers['app:panelclosed']
    closeHandler({ panelId: 'gep-grid-info' })

    expect(mockGridLayer.clearHighlight).toHaveBeenCalled()
  })

  test('other panel close does not clear highlight', async () => {
    await registerGridPlugin(interactiveMap, arcgisMap, view)

    const closeHandler = interactiveMap._handlers['app:panelclosed']
    closeHandler({ panelId: 'other-panel' })

    expect(mockGridLayer.clearHighlight).not.toHaveBeenCalled()
  })

  test('sets initial disabled state based on canShow', async () => {
    mockGridLayer.canShow.mockReturnValue(false)
    await registerGridPlugin(interactiveMap, arcgisMap, view)

    expect(interactiveMap.toggleButtonState).toHaveBeenCalledWith(
      'gep-grid-toggle',
      'disabled',
      true
    )
  })

  test('disables button when zooming out past threshold', async () => {
    mockGridLayer.canShow.mockReturnValue(true)
    await registerGridPlugin(interactiveMap, arcgisMap, view)

    mockGridLayer.canShow.mockReturnValue(false)
    const renderHandler = interactiveMap._handlers['map:render']
    renderHandler()

    expect(interactiveMap.toggleButtonState).toHaveBeenCalledWith(
      'gep-grid-toggle',
      'disabled',
      true
    )
  })

  test('enables button when zooming in past threshold', async () => {
    mockGridLayer.canShow.mockReturnValue(false)
    await registerGridPlugin(interactiveMap, arcgisMap, view)

    mockGridLayer.canShow.mockReturnValue(true)
    const renderHandler = interactiveMap._handlers['map:render']
    renderHandler()

    expect(interactiveMap.toggleButtonState).toHaveBeenCalledWith(
      'gep-grid-toggle',
      'disabled',
      false
    )
  })
})
