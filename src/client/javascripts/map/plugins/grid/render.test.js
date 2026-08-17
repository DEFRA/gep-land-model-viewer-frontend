// @vitest-environment jsdom
import { BngReference } from './bng-reference.js'
import { renderCellInfoHtml } from './render.js'

function renderHtml (html) {
  const container = document.createElement('div')
  container.innerHTML = html
  return container
}

function gridCell (overrides = {}) {
  return {
    bngRef: 'SE60007003',
    landUse: { label: 'Agriculture', code: 'U011' },
    landCover: { label: 'Cropped land', code: 'C010', source: 'UKCEH LCM2024', date: new Date(2015, 3, 28) },
    soil: { label: 'Surface-water gley soils', code: 'S070', source: 'Cranfield Soils Data', date: new Date(2026, 3, 28) },
    topography: { source: 'LIDAR Composite Digital Terrain Model (DTM) 1m', date: new Date(2023, 2, 8) },
    elevation: { min: 50.01, mean: 50.01, max: 50.11, mode: null },
    slope: { min: 0.1, mode: 0.5, max: 1.5, mean: null },
    aspect: { label: 'EAST', mean: null },
    ...overrides
  }
}

function hit (overrides = {}) {
  return { cellId: new BngReference('SE', '6000', '7003'), ...overrides }
}

describe('#renderCellInfoHtml', () => {
  test('renders grid square reference', () => {
    const container = renderHtml(renderCellInfoHtml(hit(), gridCell()))
    const ids = container.querySelector('.app-map__info-ids')

    expect(ids).not.toBeNull()
    expect(ids.textContent).toContain('Grid square')
    expect(ids.textContent).toContain('SE 6000 7003')
  })

  test('renders open collapsible land model attribute sections', () => {
    const container = renderHtml(renderCellInfoHtml(hit(), gridCell()))
    const sections = [...container.querySelectorAll('.app-map__info-section')]
    const titles = sections.map(s => s.querySelector('.app-map__info-section-title').textContent.trim())

    expect(titles).toEqual(['Land cover', 'Land use', /* 'Topography', */ 'Soils'])
  })

  test('renders an unavailable notice when details are null', () => {
    const container = renderHtml(renderCellInfoHtml(hit(), null))
    const notice = container.querySelector('.app-map__info-unavailable')

    expect(notice).not.toBeNull()
    expect(notice.textContent).toContain('not covered by the sample land model')
    expect(notice.querySelector('.app-map__info-sample-link')).not.toBeNull()
    expect(container.querySelector('.app-map__info-ids').textContent).toContain('SE 6000 7003')
  })

  test('renders dashes for null attribute fields', () => {
    const details = gridCell({ landUse: { label: null, code: null } })
    const container = renderHtml(renderCellInfoHtml(hit(), details))
    const landUseSection = container.querySelectorAll('.app-map__info-section')[1]
    const preview = landUseSection.querySelector('.app-map__info-section-value')

    expect(preview.textContent).toBe('-')
  })

  test.skip('renders the topography table with metres and degrees', () => {
    // Disabled for R1
    const container = renderHtml(renderCellInfoHtml(hit(), gridCell()))
    const table = container.querySelector('.app-map__topo-table')
    const cells = [...table.querySelectorAll('.govuk-table__cell')]
    const values = cells.map(c => c.textContent)

    expect(values).toContain('50.01m')
    expect(values).toContain('0.5°')
  })

  test.skip('renders aspect label in sentence case in the mean row', () => {
    // Disabled for R1
    const container = renderHtml(renderCellInfoHtml(hit(), gridCell()))
    const rows = [...container.querySelectorAll('.app-map__topo-table .govuk-table__row')]
    const meanRow = rows.find(r => r.querySelector('.govuk-table__header')?.textContent === 'Mean')
    const aspectCell = meanRow.querySelectorAll('.govuk-table__cell')[2]

    expect(aspectCell.textContent).toBe('East')
  })

  test.skip('pairs the slope summary with its aspect direction', () => {
    // Disabled for R1
    const container = renderHtml(renderCellInfoHtml(hit(), gridCell()))
    const topoSection = container.querySelectorAll('.app-map__info-section')[2]
    const preview = topoSection.querySelector('.app-map__info-section-value')

    expect(preview.textContent).toContain('0.5° (East)')
  })

  test('renders data source and last updated for each section', () => {
    const container = renderHtml(renderCellInfoHtml(hit(), gridCell()))
    const text = container.textContent

    expect(text).toContain('UKCEH LCM2024')
    expect(text).toContain('Cranfield Soils Data')
    // Topography disabled for R1
    // expect(text).toContain('LIDAR Composite Digital Terrain Model (DTM) 1m')
  })

  test('renders dominant cover label in the land cover section', () => {
    const container = renderHtml(renderCellInfoHtml(hit(), gridCell()))
    const landCoverSection = container.querySelectorAll('.app-map__info-section')[0]

    expect(landCoverSection.textContent).toContain('Dominant cover')
    expect(landCoverSection.textContent).toContain('Cropped land')
  })

  test.skip('renders dashes for null elevation, slope, and aspect values', () => {
    // Disabled for R1
    const details = gridCell({
      elevation: { min: null, mean: null, max: null, mode: null },
      slope: { min: null, mode: null, max: null, mean: null },
      aspect: { label: null, mean: null }
    })
    const container = renderHtml(renderCellInfoHtml(hit(), details))
    const cells = [...container.querySelectorAll('.app-map__topo-table .govuk-table__cell')]
    const values = cells.map(c => c.textContent)

    expect(values).toHaveLength(12)
    expect(values.every(v => v === '-')).toBe(true)
  })

  test.skip('renders slope without aspect when aspect is null', () => {
    // Disabled for R1
    const details = gridCell({ aspect: { label: null, mean: null } })
    const container = renderHtml(renderCellInfoHtml(hit(), details))
    const topoSection = container.querySelectorAll('.app-map__info-section')[2]
    const preview = topoSection.querySelector('.app-map__info-section-value')

    expect(preview.textContent).toContain('0.5°')
    expect(preview.textContent).not.toContain('(')
  })

  test('renders dashes for null dates', () => {
    const details = gridCell({
      landCover: { label: 'Cropped land', code: 'C010', source: 'UKCEH LCM2024', date: null },
      soil: { label: 'Brown soils', code: 'S050', source: 'Cranfield', date: null },
      topography: { source: 'LIDAR', date: null }
    })
    const container = renderHtml(renderCellInfoHtml(hit(), details))
    const rows = [...container.querySelectorAll('.govuk-summary-list__row')]
    const lastUpdatedRows = rows.filter(r => r.querySelector('.govuk-summary-list__key')?.textContent === 'Last updated')

    expect(lastUpdatedRows.every(r => r.querySelector('.govuk-summary-list__value').textContent === '-')).toBe(true)
  })

  test('formats dates as yyyy-MM-dd', () => {
    const container = renderHtml(renderCellInfoHtml(hit(), gridCell()))
    const text = container.textContent

    expect(text).toContain('2015-04-28')
  })
})
