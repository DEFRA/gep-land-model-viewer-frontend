// @vitest-environment jsdom
import { vi, describe, test, expect } from 'vitest'

vi.mock('@defra/interactive-map', () => ({
  EVENTS: { MAP_RENDER: 'map:render', APP_PANEL_CLOSED: 'app:panelclosed' }
}))

const createPlugin = (await import('./index.js')).default
const { manifest } = await import('./manifest.js')

describe('layers plugin', () => {
  test('registers under a fixed id and passes its options through', () => {
    const plugin = createPlugin({ id: 'something-else', styleNonce: 'nonce' })

    expect(plugin.id).toBe('gepLayers')
    expect(plugin.styleNonce).toBe('nonce')
  })

  test('loads its manifest', async () => {
    await expect(createPlugin().load()).resolves.toBe(manifest)
  })

  test('the layers button steps aside while its panel is open', async () => {
    const manifest = await createPlugin().load()
    const [layersButton, keyButton] = manifest.buttons

    expect(layersButton.hiddenWhen({ appState: { openPanels: { gepLayers: {} } } })).toBe(true)
    expect(layersButton.hiddenWhen({ appState: { openPanels: {} } })).toBe(false)
    expect(layersButton.hiddenWhen({ appState: {} })).toBe(false)
    expect(keyButton.hiddenWhen).toBeUndefined()
  })

  test('enables map-dependent buttons only when the map is ready', () => {
    const [layersButton, keyButton] = manifest.buttons

    for (const button of [layersButton, keyButton]) {
      expect(button.enableWhen({ mapState: { isMapReady: false } })).toBe(false)
      expect(button.enableWhen({ mapState: { isMapReady: true } })).toBe(true)
    }
  })

  test('enables Select an area only with a land summary layer shown at its zoom', () => {
    const selectArea = manifest.buttons.find(button => button.id === 'gepSelectArea')
    const context = (layers, { isMapReady = true, zoom = 10 } = {}) => ({ mapState: { isMapReady, zoom }, pluginState: { layers } })
    const grid = { id: 'grid', ready: true, hidden: false }
    const features = { id: 'features', ready: true, hidden: false, minZoom: 10 }
    const woodland = { id: 'ancient-woodland', ready: true, hidden: false }

    expect(selectArea.enableWhen(context([grid]))).toBe(true)
    expect(selectArea.enableWhen(context([features]))).toBe(true)
    expect(selectArea.description(context([grid]))).toBeUndefined()

    expect(selectArea.enableWhen(context([grid], { isMapReady: false }))).toBe(false)

    expect(selectArea.enableWhen(context([woodland]))).toBe(false)
    expect(selectArea.enableWhen(context([{ ...grid, hidden: true }]))).toBe(false)
    expect(selectArea.description(context([woodland]))).toBe('Turn on Grid squares or Features in Land summary first')

    expect(selectArea.enableWhen(context([features], { zoom: 9 }))).toBe(false)
    expect(selectArea.description(context([features], { zoom: 9 }))).toBe('Zoom in to see Features first')
  })

  test('Select an area starts a polygon with the draw plugin', () => {
    const selectArea = manifest.buttons.find(button => button.id === 'gepSelectArea')
    const draw = { newPolygon: vi.fn() }

    selectArea.onClick({}, { services: { getPlugin: id => id === 'draw' ? draw : undefined } })

    expect(draw.newPolygon).toHaveBeenCalledWith(expect.any(String))
  })

  test('derives the Info panel title from inspection state', () => {
    const info = manifest.panels.find(panel => panel.id === 'gepInfoPanel')
    const label = /** @type {Function} */ (info.label)

    expect(label({ pluginState: { inspection: { status: 'idle', hits: [], hit: null } } }))
      .toBeUndefined()
    expect(label({ pluginState: { inspection: { status: 'searching', hits: [], hit: null } } }))
      .toBe('Loading details')
    expect(label({ pluginState: { inspection: { status: 'empty', hits: [], hit: null } } }))
      .toBe('No information found')
    expect(label({ pluginState: { inspection: { status: 'detail-error', hits: [], hit: null } } }))
      .toBe('Could not load details')
    expect(label({ pluginState: { inspection: { status: 'list', hits: [{}, {}], hit: null } } }))
      .toBe('2 layers selected')
    expect(label({ pluginState: { inspection: { status: 'detail-ready', hits: [], hit: { label: 'OS feature' } } } }))
      .toBe('OS feature')
    expect(label({ pluginState: { inspection: { status: 'detail-ready', hits: [], hit: { label: 'Woodland', panelTitle: 'Data layer attributes' } } } }))
      .toBe('Data layer attributes')
    expect(label({ pluginState: { inspection: { status: 'detail-loading', hits: [], hit: null, selection: { title: 'Grid squares' } } } }))
      .toBe('Grid squares')
  })
})
