// @vitest-environment jsdom
import { describe, test, expect } from 'vitest'
import { renderEmptyStateHtml, renderFeatureInfoHtml } from './render.js'

/**
 * @param {object} [overrides]
 * @returns {import('./data.js').Parcel}
 */
function parcel (overrides = {}) {
  return {
    osid: 'abc-123',
    toid: 'osgb-1',
    landUse: { label: 'Agriculture', code: 'U011' },
    landCover: {
      dominantLabel: 'Improved grass',
      dominantCode: 'C021',
      isMixed: true,
      breakdown: [
        { label: 'Improved grass', percentage: 82.2 },
        { label: 'Woodland', percentage: 17.8 }
      ],
      source: 'UKCEH LCM2024',
      date: new Date(2015, 3, 28)
    },
    soil: {
      dominantLabel: 'Brown soils',
      dominantCode: 'S050',
      isMixed: false,
      breakdown: [{ label: 'Brown soils', percentage: 100 }],
      source: 'Cranfield Soils Data',
      date: new Date(2026, 3, 28)
    },
    topography: { source: 'LIDAR Composite Digital Terrain Model (DTM) 1m', date: new Date(2023, 2, 8) },
    elevation: { min: 82, mean: 85, mode: null, max: 91 },
    slope: { min: 0, mean: null, mode: 2, max: 4 },
    aspect: { mean: 147.83, label: 'FLAT' },
    ...overrides
  }
}

function render (overrides) {
  const container = document.createElement('div')
  container.innerHTML = renderFeatureInfoHtml({ osid: 'abc-123' }, parcel(overrides))
  return container
}

function topoCells (container, label) {
  const rows = [...container.querySelectorAll('.app-map__topo-table tbody tr')]
  const row = rows.find((r) => r.querySelector('.govuk-table__header').textContent.trim() === label)
  return [...row.querySelectorAll('.govuk-table__cell')].map((cell) => cell.textContent.trim())
}

describe('#renderEmptyStateHtml', () => {
  test('renders guidance to select a land parcel', () => {
    const container = document.createElement('div')
    container.innerHTML = renderEmptyStateHtml()

    expect(container.querySelector('.app-map__info-panel-message').textContent)
      .toBe('Select a land parcel on the map to view its details.')
  })
})

describe('#renderFeatureInfoHtml', () => {
  test('renders the OSID and TOID', () => {
    const text = render().textContent

    expect(text).toContain('abc-123')
    expect(text).toContain('osgb-1')
  })

  test('renders a collapsible section for each attribute category', () => {
    const headings = [...render().querySelectorAll('.app-map__info-section-title')].map((el) => el.textContent.trim())

    expect(headings).toEqual(['Land cover', 'Land use', 'Topography', 'Soils'])
  })

  test('summarises a mixed category as "Mixed"', () => {
    const value = render().querySelector('.app-map__info-section-value').textContent.trim()

    expect(value).toBe('Mixed')
  })

  test('renders a proportion bar per breakdown entry', () => {
    const landCover = render().querySelector('.app-map__info-section')
    const bars = landCover.querySelectorAll('.app-map__cover-bar')

    expect(bars).toHaveLength(2)
    expect(bars[0].dataset.appPercent).toBe('82.2')
    expect(landCover.textContent).toContain('82.2%')
  })

  test('renders the topography table with metres and degrees', () => {
    const text = render().querySelector('.app-map__topo-details').textContent

    expect(text).toContain('85m')
    expect(text).toContain('4°')
  })

  test('labels elevation by its mean, slope by its mode and aspect by its mean with direction', () => {
    const container = render()

    expect(topoCells(container, 'Mean')).toEqual(['85m', '-', '147.83° (Flat)'])
    expect(topoCells(container, 'Mode')).toEqual(['-', '2°', '-'])
  })

  test('pairs the slope summary with its aspect', () => {
    expect(render().textContent).toContain('Slope: 2° (Flat)')
  })

  test('renders dashes for missing topography values', () => {
    const container = render({
      elevation: { min: null, mean: null, mode: null, max: null },
      slope: { min: null, mean: null, mode: null, max: null },
      aspect: { mean: null, label: null }
    })

    expect(topoCells(container, 'Minimum')).toEqual(['-', '-', '-'])
    expect(topoCells(container, 'Mean')).toEqual(['-', '-', '-'])
    expect(topoCells(container, 'Mode')).toEqual(['-', '-', '-'])
  })

  test('omits the aspect from the slope summary when the aspect label is null', () => {
    const text = render({ slope: { ...parcel().slope, mode: 5 }, aspect: { mean: 0, label: null } }).textContent

    expect(text).toContain('Slope: 5°')
    expect(text).not.toContain('Slope: 5° (')
  })

  test('renders dashes for null attribute fields', () => {
    const container = render({
      landCover: { ...parcel().landCover, isMixed: false, dominantLabel: null, source: null },
      landUse: { label: null, code: null },
      soil: { ...parcel().soil, source: null }
    })
    const sections = [...container.querySelectorAll('.app-map__info-section')]
    const landUse = sections.find((s) => s.textContent.includes('Land use'))

    expect(landUse.querySelector('.app-map__info-section-value').textContent.trim()).toBe('-')
  })

  test('summarises mixed soils as "Mixed"', () => {
    const container = render({
      soil: { ...parcel().soil, isMixed: true }
    })
    const soilSection = [...container.querySelectorAll('.app-map__info-section')]
      .find((s) => s.textContent.includes('Soils'))

    expect(soilSection.querySelector('.app-map__info-section-value').textContent.trim()).toBe('Mixed')
  })

  test('escapes HTML in attribute values', () => {
    const container = render({
      landCover: { ...parcel().landCover, isMixed: false, dominantLabel: '"><script>alert(1)</script>' }
    })

    expect(container.querySelector('script')).toBeNull()
  })

  test('renders an unavailable message when there are no attributes', () => {
    const container = document.createElement('div')
    container.innerHTML = renderFeatureInfoHtml({ osid: 'abc-123' }, null)

    expect(container.textContent).toContain('abc-123')
    expect(container.textContent).toContain('unavailable')
  })
})
