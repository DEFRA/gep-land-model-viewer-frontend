import {
  renderDatasetAttributesHtml,
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

  test('renders the land summary toggles above the dataset list', () => {
    const html = renderLayersPanelHtml(testDatasets)

    expect(html).toContain('data-app-summary-id="grid"')
    expect(html).toContain('data-app-summary-id="features"')
    expect(html.indexOf('app-map__land-summary')).toBeLessThan(html.indexOf('data-app-layer-list'))
  })

  test('handles empty datasets array', () => {
    const html = renderLayersPanelHtml([])

    expect(html).toContain('data-app-layer-list')
    expect(html).not.toContain('data-app-layer-item')
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

  test('search is wrapped in a form with role="search"', () => {
    const html = renderLayersPanelHtml(testDatasets)

    expect(html).toContain('role="search"')
    expect(html).toContain('data-app-layer-search-form')
    expect(html).toMatch(/type="submit"/)
  })

  test('empty message has role="status" for screen reader announcements', () => {
    const html = renderLayersPanelHtml(testDatasets)

    expect(html).toContain('data-app-layer-empty')
    expect(html).toMatch(/data-app-layer-empty[^>]*role="status"/)
  })
})

describe('#renderDatasetAttributesHtml', () => {
  test('renders a summary list per feature under the dataset label', () => {
    const html = renderDatasetAttributesHtml('Flood Zones', [{ zone: '2' }, { zone: '3' }])

    expect(html).toContain('Flood Zones')
    expect(html.match(/app-map__info-attributes/g)).toHaveLength(2)
    expect(html).toContain('zone')
    expect(html).toContain('3')
  })

  test('skips null and empty attribute values', () => {
    const html = renderDatasetAttributesHtml('Flood Zones', [{ zone: '2', empty: '', missing: null }])

    expect(html).toContain('zone')
    expect(html).not.toContain('empty')
    expect(html).not.toContain('missing')
  })

  test('escapes the label and attribute values', () => {
    const html = renderDatasetAttributesHtml('<b>Label</b>', [{ name: '<script>x</script>' }])

    expect(html).not.toContain('<b>')
    expect(html).not.toContain('<script>')
  })

  test('shows an empty message when no features carry attributes', () => {
    const html = renderDatasetAttributesHtml('Flood Zones', [])

    expect(html).toContain('No attributes found at this location.')
  })
})
