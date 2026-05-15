import {
  renderFeatureInfoPanelHtml,
  renderLayersPanelHtml
} from './render.js'

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

  test('wraps checkboxes in a fieldset with visually hidden legend', () => {
    const html = renderLayersPanelHtml(testDatasets)

    expect(html).toContain('<fieldset class="govuk-fieldset">')
    expect(html).toContain('<legend class="govuk-visually-hidden">Data layers</legend>')
  })

  test('search input has aria-controls linked to layer list', () => {
    const html = renderLayersPanelHtml(testDatasets)

    expect(html).toContain('aria-controls="layers-list"')
    expect(html).toContain('id="layers-list"')
  })

  test('empty message has role="status" for screen reader announcements', () => {
    const html = renderLayersPanelHtml(testDatasets)

    expect(html).toContain('data-app-layer-empty')
    expect(html).toMatch(/data-app-layer-empty[^>]*role="status"/)
  })
})

describe('#renderFeatureInfoPanelHtml', () => {
  test('renders status and content regions', () => {
    const html = renderFeatureInfoPanelHtml('status-id', 'content-id')

    expect(html).toContain('id="status-id"')
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('id="content-id"')
    expect(html).toContain('app-map__layer-info-panel')
  })
})
