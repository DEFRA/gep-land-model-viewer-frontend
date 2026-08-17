// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'
import { registerZoomWarning } from './zoom-warning.js'

describe('#registerZoomWarning', () => {
  let map
  let state
  let moveendHandler

  beforeEach(() => {
    document.body.innerHTML = '<div class="app-map"><div id="map-target" aria-hidden="true"><div id="map-container"></div></div></div>'
    state = { zoom: 12 }
    map = {
      getTargetElement: vi.fn(() => document.getElementById('map-target')),
      getOverlayContainerStopEvent: vi.fn(() => document.getElementById('map-container')),
      getView: vi.fn(() => ({ getZoom: () => state.zoom })),
      on: vi.fn((type, handler) => {
        if (type === 'moveend') {
          moveendHandler = handler
        }
      })
    }
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  function banner () {
    return document.querySelector('.app-map__zoom-warning')
  }

  function liveRegion () {
    return document.querySelector('[role="status"]')
  }

  test('starts hidden', () => {
    registerZoomWarning(map)

    expect(banner().hidden).toBe(true)
  })

  test('announces from a live region outside the aria-hidden map container', () => {
    const warning = registerZoomWarning(map)

    expect(liveRegion().closest('[aria-hidden="true"]')).toBeNull()
    expect(liveRegion().hidden).toBe(false)
    expect(liveRegion().textContent).toBe('')

    state.zoom = 8
    warning.set('grid', { label: 'grid squares', minZoom: 11, enabled: true })

    expect(liveRegion().hidden).toBe(false)
    expect(liveRegion().textContent).toBe('Zoom in to see grid squares')
  })

  test('names a single layer that is below its zoom', () => {
    const warning = registerZoomWarning(map)

    state.zoom = 8
    warning.set('grid', { label: 'grid squares', minZoom: 11, enabled: true })

    expect(banner().hidden).toBe(false)
    expect(banner().textContent).toBe('Zoom in to see grid squares')
  })

  test('several layers below their zoom share one message', () => {
    const warning = registerZoomWarning(map)

    state.zoom = 8
    warning.set('grid', { label: 'grid squares', minZoom: 11, enabled: true })
    warning.set('features', { label: 'OS features', minZoom: 10, enabled: true })

    expect(banner().textContent).toBe('Zoom in to see the selected data layers')
  })

  test('stays hidden when the enabled layers are in range', () => {
    const warning = registerZoomWarning(map)

    warning.set('grid', { label: 'grid squares', minZoom: 11, enabled: true })

    expect(banner().hidden).toBe(true)
  })

  test('disabling a layer removes it from the warning', () => {
    const warning = registerZoomWarning(map)

    state.zoom = 8
    warning.set('grid', { label: 'grid squares', minZoom: 11, enabled: true })
    warning.set('grid', { label: 'grid squares', minZoom: 11, enabled: false })

    expect(banner().hidden).toBe(true)
  })

  test('zooming updates the warning on moveend', () => {
    const warning = registerZoomWarning(map)

    state.zoom = 8
    warning.set('grid', { label: 'grid squares', minZoom: 11, enabled: true })
    expect(banner().hidden).toBe(false)

    state.zoom = 12
    moveendHandler()

    expect(banner().hidden).toBe(true)
  })
})
