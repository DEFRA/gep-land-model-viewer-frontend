import { vi, describe, test, expect } from 'vitest'
import { createInspectController } from './controller.js'

function makeHarness ({ zoom = 12, minZoom = 10 } = {}) {
  const state = { zoom }
  const view = { getZoom: vi.fn(() => state.zoom) }
  const map = { getView: vi.fn(() => view) }
  const layer = { setEnabled: vi.fn() }
  const inspector = {
    hitTest: vi.fn(() => ({ id: 'hit-1' })),
    select: vi.fn(),
    loadDetails: vi.fn(async () => ({ detail: 'value' })),
    renderHtml: vi.fn(() => '<p>rendered</p>'),
    clearSelection: vi.fn()
  }
  const infoPanel = { activate: vi.fn(), deactivate: vi.fn() }
  const controller = createInspectController(map, {
    minZoom,
    layer,
    label: 'Grid square',
    panelTitle: 'Grid square',
    inspector,
    infoPanel
  })
  return { state, layer, inspector, infoPanel, controller }
}

function activatedSource (infoPanel) {
  return infoPanel.activate.mock.calls[0][0]
}

describe('#createInspectController', () => {
  test('showing enables the layer and hit source', () => {
    const { layer, infoPanel, controller } = makeHarness()

    controller.setVisible(true)

    expect(layer.setEnabled).toHaveBeenCalledWith(true)
    expect(infoPanel.activate).toHaveBeenCalledTimes(1)
  })

  test('hiding deactivates the same hit source', () => {
    const { layer, infoPanel, controller } = makeHarness()

    controller.setVisible(true)
    controller.setVisible(false)

    expect(layer.setEnabled).toHaveBeenLastCalledWith(false)
    expect(infoPanel.deactivate).toHaveBeenCalledWith(activatedSource(infoPanel))
  })

  test('getHits wraps the inspector hit with the label and its callbacks', async () => {
    const { inspector, infoPanel, controller } = makeHarness()
    controller.setVisible(true)

    const hits = activatedSource(infoPanel).getHits([1, 2])

    expect(inspector.hitTest).toHaveBeenCalledWith([1, 2])
    expect(hits).toHaveLength(1)
    expect(hits[0].label).toBe('Grid square')
    expect(hits[0].panelTitle).toBe('Grid square')

    hits[0].select()
    expect(inspector.select).toHaveBeenCalledWith({ id: 'hit-1' })

    await hits[0].loadDetails({ signal: null })
    expect(inspector.loadDetails).toHaveBeenCalledWith({ id: 'hit-1' }, { signal: null })

    expect(hits[0].renderHtml({ detail: 'value' })).toBe('<p>rendered</p>')
    expect(inspector.renderHtml).toHaveBeenCalledWith({ id: 'hit-1' }, { detail: 'value' })
  })

  test('a missed hit test returns no hits', () => {
    const { inspector, infoPanel, controller } = makeHarness()
    inspector.hitTest.mockReturnValue(null)
    controller.setVisible(true)

    expect(activatedSource(infoPanel).getHits([1, 2])).toEqual([])
  })

  test('clicks below the mode zoom do not hit', () => {
    const { state, inspector, infoPanel, controller } = makeHarness({ zoom: 12, minZoom: 10 })
    controller.setVisible(true)
    const source = activatedSource(infoPanel)

    state.zoom = 8
    expect(source.getHits([1, 2])).toEqual([])
    expect(inspector.hitTest).not.toHaveBeenCalled()

    state.zoom = 12
    expect(source.getHits([1, 2])).toHaveLength(1)
  })

  test('clearSelection delegates to the inspector', () => {
    const { inspector, infoPanel, controller } = makeHarness()
    controller.setVisible(true)

    activatedSource(infoPanel).clearSelection()

    expect(inspector.clearSelection).toHaveBeenCalled()
  })
})
