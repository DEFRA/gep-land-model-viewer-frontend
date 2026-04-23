import { renderLayersPanelHtml } from './render.js'

describe('#renderLayersPanelHtml', () => {
  const testDatasets = [
    { id: 'dataset-1', label: 'Flood Zones', defaultVisible: true },
    { id: 'dataset-2', label: 'Water Bodies', defaultVisible: false }
  ]

  test('renders checkboxes', () => {
    const html = renderLayersPanelHtml(testDatasets)

    expect(html).toMatch(/id="layer-dataset-1"[^>]*checked/)
    expect(html).not.toMatch(/id="layer-dataset-2"[^>]*checked/)
    expect(html).toContain('data-label="flood zones"')
    expect(html).toContain('data-label="water bodies"')
  })

  test('handles empty datasets array', () => {
    const html = renderLayersPanelHtml([])

    expect(html).toContain('data-app-layer-list')
    expect(html).not.toContain('govuk-checkboxes__item')
  })
})
