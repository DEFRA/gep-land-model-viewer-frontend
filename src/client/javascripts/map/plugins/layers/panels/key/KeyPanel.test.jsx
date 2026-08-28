// @vitest-environment jsdom
import { vi, describe, test, expect } from 'vitest'
import { render } from '@testing-library/preact'

vi.mock('./key-entries.js', () => ({ getKeyEntries: vi.fn() }))

const { getKeyEntries } = await import('./key-entries.js')
const { KeyPanel } = await import('./KeyPanel.jsx')

const ENTRIES = [{
  label: 'Flood Zones',
  baseUrl: 'https://environment.data.gov.uk/wms',
  layerNames: ['flood_zone_2', 'flood_zone_3']
}]
const MAP = { id: 'map' }
const DATASETS = [{ id: 'flood', label: 'Flood Zones' }]

let view

function renderPanel (entries) {
  vi.mocked(getKeyEntries).mockReturnValue(entries)
  view = render(<KeyPanel mapProvider={{ map: MAP }} pluginConfig={{ datasets: DATASETS }} />)
}

describe('KeyPanel', () => {
  test('prompts for a layer when nothing is enabled', () => {
    renderPanel([])

    expect(view.container.textContent).toBe('Enable data layers to view the key.')
    expect(view.container.querySelector('.app-map__key-grid')).toBeNull()
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

  test('derives the current key without owning copied state', () => {
    renderPanel(ENTRIES)

    expect(getKeyEntries).toHaveBeenCalledWith(MAP, DATASETS)
    expect(view.container.textContent).toContain('Flood Zones')
  })
})
