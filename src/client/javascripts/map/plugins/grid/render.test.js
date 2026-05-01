// @vitest-environment jsdom
import { renderInitialInfoPanelHtml, renderCellInfoHtml } from './render.js'

function renderHtml (html) {
  const container = document.createElement('div')
  container.innerHTML = html
  return container
}

describe('#renderInitialInfoPanelHtml', () => {
  test('renders a grid info panel container with empty guidance', () => {
    const container = renderHtml(renderInitialInfoPanelHtml('test-content-id'))
    const panel = container.querySelector('#test-content-id')

    expect(panel).not.toBeNull()
    expect(panel.classList.contains('app-map__grid-info-panel')).toBe(true)
    expect(panel.textContent).toContain('Click a grid cell on the map to view its details.')
  })
})

describe('#renderCellInfoHtml', () => {
  test('renders cell coordinates and grid square reference', () => {
    const cell = { cellId: 'E418720N385130', easting: 418720, northing: 385130 }
    const container = renderHtml(renderCellInfoHtml(cell))
    const coordinates = container.querySelector('.app-map__grid-info-coordinates')

    expect(coordinates).not.toBeNull()
    expect(coordinates.textContent).toContain('Easting')
    expect(coordinates.textContent).toContain('418720')
    expect(coordinates.textContent).toContain('Northing')
    expect(coordinates.textContent).toContain('385130')
    expect(container.querySelector('.app-map__grid-info-reference').textContent).toBe('Grid square: E418720N385130')
  })

  test('renders open collapsible land model attribute sections', () => {
    const cell = { cellId: 'E418720N385130', easting: 418720, northing: 385130 }
    const container = renderHtml(renderCellInfoHtml(cell))
    const sections = [...container.querySelectorAll('.app-map__grid-info-section')]

    expect(sections).toHaveLength(2)
    expect(sections.every(section => section.open)).toBe(true)
    expect(sections.map(section => section.querySelector('summary').textContent)).toEqual(['Land use', 'Topography'])
  })
})
