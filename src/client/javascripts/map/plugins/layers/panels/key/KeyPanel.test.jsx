// @vitest-environment jsdom
import { vi, describe, test, expect } from 'vitest'
import { render } from '@testing-library/preact'

vi.mock('./key-entries.js', () => ({ getKeyEntries: vi.fn() }))

const { getKeyEntries } = await import('./key-entries.js')
const { KeyPanel } = await import('./KeyPanel.jsx')

const ENTRIES = [{
  type: 'wms',
  id: 'flood',
  label: 'Flood Zones',
  baseUrl: 'https://environment.data.gov.uk/wms',
  layerNames: ['flood_zone_2', 'flood_zone_3']
}, {
  type: 'style',
  id: 'sssi',
  label: 'Sites of Special Scientific Interest',
  styles: [{
    label: 'Site of Special Scientific Interest',
    fill: [178, 102, 204, 1],
    stroke: { color: [112, 48, 135, 1], width: 1.25 }
  }, {
    label: 'Transparent fill with an outline',
    fill: [0, 0, 0, 0],
    stroke: { color: [12, 34, 56, 0.5], width: 3 }
  }, {
    label: 'Fill with a disabled outline',
    fill: [10, 20, 30, 1],
    stroke: { color: [40, 50, 60, 1], width: 0 }
  }]
}]
const DATASETS = [{ id: 'flood', label: 'Flood Zones' }]
const EMPTY_PLUGIN_STATE = { layers: [] }

let view

function renderPanel (entries) {
  vi.mocked(getKeyEntries).mockReturnValue(entries)
  view = render(
    <KeyPanel
      pluginConfig={{ datasets: DATASETS }}
      pluginState={EMPTY_PLUGIN_STATE}
    />
  )
}

describe('KeyPanel', () => {
  test('prompts for a layer when nothing is enabled', () => {
    renderPanel([])

    expect(view.container.textContent).toBe('Enable data layers to view the key.')
    expect(view.container.querySelector('.app-map__key-grid')).toBeNull()
    expect(getKeyEntries).toHaveBeenCalledWith(DATASETS, EMPTY_PLUGIN_STATE)
  })

  test('shows one legend image per WMS layer, titled by dataset', () => {
    renderPanel(ENTRIES)

    expect(view.container.querySelector('h3').textContent).toBe('Flood Zones')

    const images = [...view.container.querySelectorAll('img')]
    expect(images).toHaveLength(2)
    expect(images[0].getAttribute('src')).toBe(
      'https://environment.data.gov.uk/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&LAYER=flood_zone_2&FORMAT=image/png'
    )
    expect(images[0].getAttribute('alt')).toBe('Legend for flood zone 2')
    expect(images[0].crossOrigin).toBe('anonymous')
  })

  test('labels each legend with the layer name in words', () => {
    renderPanel(ENTRIES)

    const names = [...view.container.querySelectorAll('.app-map__key-legend-row span')]
    expect(names.map(name => name.textContent)).toEqual(['flood zone 2', 'flood zone 3'])
  })

  test('shows labelled style swatches for operational datasets', () => {
    renderPanel(ENTRIES)

    const styles = [...view.container.querySelectorAll('.app-map__key-style-row')]
    expect(styles.map(style => style.textContent)).toEqual([
      'Site of Special Scientific Interest',
      'Transparent fill with an outline',
      'Fill with a disabled outline'
    ])

    const swatches = styles.map(style => style.querySelector('.app-map__key-style-swatch'))
    expect(swatches.map(swatch => swatch.style.backgroundColor)).toEqual([
      'rgb(178, 102, 204)',
      'rgba(0, 0, 0, 0)',
      'rgb(10, 20, 30)'
    ])
    expect(swatches.map(swatch => swatch.style.borderColor)).toEqual([
      'rgb(112, 48, 135)',
      'rgba(12, 34, 56, 0.5)',
      ''
    ])
    expect(swatches.map(swatch => swatch.style.borderWidth)).toEqual(['2px', '3px', ''])
    expect(swatches.every(swatch => swatch.getAttribute('aria-hidden') === 'true')).toBe(true)
  })
})
