// @vitest-environment jsdom
import { vi, describe, test, expect } from 'vitest'

vi.mock('@defra/interactive-map', () => ({
  EVENTS: { MAP_RENDER: 'map:render', APP_PANEL_CLOSED: 'app:panelclosed' }
}))

const createPlugin = (await import('./index.js')).default
const { manifest } = await import('./manifest.js')

const DATASETS = [{ id: 'woodland', label: 'Ancient Woodland' }]

describe('layers plugin', () => {
  test('registers under a fixed id and passes its datasets through as config', () => {
    const plugin = createPlugin({ id: 'something-else', datasets: DATASETS })

    expect(plugin.id).toBe('gepLayers')
    expect(plugin.datasets).toBe(DATASETS)
    expect(createPlugin().datasets).toEqual([])
  })

  test('loads its manifest', async () => {
    await expect(createPlugin({ datasets: DATASETS }).load()).resolves.toBe(manifest)
  })

  test('the layers button steps aside while its panel is open', async () => {
    const manifest = await createPlugin({ datasets: DATASETS }).load()
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

  test('derives the Info panel title from inspection state', () => {
    const info = manifest.panels.find(panel => panel.id === 'gepInfoPanel')
    const label = /** @type {Function} */ (info.label)

    expect(label({ pluginState: { inspection: { status: 'idle', hits: [], hit: null } } }))
      .toBeUndefined()
    expect(label({ pluginState: { inspection: { status: 'searching', hits: [], hit: null } } }))
      .toBe('Loading details')
    expect(label({ pluginState: { inspection: { status: 'empty', hits: [], hit: null } } }))
      .toBe('No information found')
    expect(label({ pluginState: { inspection: { status: 'list', hits: [{}, {}], hit: null } } }))
      .toBe('2 layers selected')
    expect(label({ pluginState: { inspection: { status: 'detail-ready', hits: [], hit: { label: 'OS feature' } } } }))
      .toBe('OS feature')
    expect(label({ pluginState: { inspection: { status: 'detail-ready', hits: [], hit: { label: 'Woodland', panelTitle: 'Data layer attributes' } } } }))
      .toBe('Data layer attributes')
  })
})
