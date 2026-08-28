// @vitest-environment jsdom
import { describe, test, expect } from 'vitest'
import { render } from '@testing-library/preact'
import { InfoPanelContext } from '../../panels/info/context.js'
import { FeatureInfo } from './FeatureInfo.jsx'

const hit = { osid: 'abc-123' }

const details = {
  osid: 'abc-123',
  toid: 'osgb-1',
  landUse: { label: 'Agriculture', code: 'U011' },
  landCover: {
    dominantLabel: 'Improved grass',
    dominantCode: 'C021',
    isMixed: true,
    breakdown: [
      { label: 'Improved grass', percentage: 60 },
      { label: 'Arable', percentage: 40 }
    ],
    source: 'UKCEH',
    date: new Date(2023, 2, 8)
  },
  soil: { dominantLabel: 'Brown soils', dominantCode: 'S011', isMixed: false, breakdown: [], source: 'Cranfield', date: null },
  topography: { source: 'LIDAR', date: null },
  elevation: { min: 1, mean: 2, mode: null, max: 3 },
  slope: { min: 0, mean: null, mode: 1, max: 2 },
  aspect: { mean: 0, label: 'FLAT' }
}

const contextValue = { sections: new Map(), goToSampleArea: () => {} }

function mount (vnode) {
  return render(
    <InfoPanelContext.Provider value={contextValue}>
      {vnode}
    </InfoPanelContext.Provider>
  )
}

let view

describe('FeatureInfo', () => {
  test('shows the identifiers and a section per attribute group', () => {
    view = mount(<FeatureInfo hit={hit} details={details} />)
    const text = view.container.textContent

    expect(text).toContain('abc-123')
    expect(text).toContain('osgb-1')

    const titles = [...view.container.querySelectorAll('.app-map__info-section-title')]
    expect(titles.map(title => title.textContent)).toEqual(['Land cover', 'Land use', 'Soils'])
  })

  test('summarises a mixed group as Mixed and a single-cover group by its dominant label', () => {
    view = mount(<FeatureInfo hit={hit} details={details} />)

    const previews = [...view.container.querySelectorAll('.app-map__info-section-value')]
    expect(previews.map(preview => preview.textContent)).toEqual(['Mixed', 'Agriculture', 'Brown soils'])
  })

  test('scales each proportion bar against the largest share', () => {
    view = mount(<FeatureInfo hit={hit} details={details} />)

    const bars = /** @type {HTMLElement[]} */ ([...view.container.querySelectorAll('.app-map__cover-bar')])
    expect(bars.map(bar => bar.style.width)).toEqual(['60%', '40%'])
    expect(bars[0].style.opacity).toBe('1')
    expect(Number(bars[1].style.opacity)).toBeCloseTo(0.783, 2)
    expect(bars.every(bar => bar.getAttribute('aria-hidden') === 'true')).toBe(true)
  })

  test('scales an unsorted breakdown against its largest share', () => {
    const unsorted = {
      ...details,
      landCover: {
        ...details.landCover,
        breakdown: [...details.landCover.breakdown].reverse()
      }
    }
    view = mount(<FeatureInfo hit={hit} details={unsorted} />)

    const bars = /** @type {HTMLElement[]} */ ([...view.container.querySelectorAll('.app-map__cover-bar')])
    expect(Number(bars[0].style.opacity)).toBeCloseTo(0.783, 2)
    expect(bars[1].style.opacity).toBe('1')
  })

  test('omits the breakdown when there is nothing to break down', () => {
    view = mount(<FeatureInfo hit={hit} details={details} />)

    expect(view.container.textContent).toContain('Proportion of area')
    expect([...view.container.querySelectorAll('.app-map__cover-list')]).toHaveLength(1)
  })

  test('offers the sample area when the parcel has no data', () => {
    view = mount(<FeatureInfo hit={hit} details={null} />)

    expect(view.container.textContent).toContain('abc-123')
    expect(view.container.textContent).toContain('This parcel is not covered by the sample land model.')
  })
})
