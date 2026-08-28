// @vitest-environment jsdom
import { describe, test, expect } from 'vitest'
import { render } from '@testing-library/preact'
import { InfoPanelContext } from '../../panels/info/context.js'
import { BngReference } from './bng-reference.js'
import { CellInfo } from './CellInfo.jsx'

const hit = { cellId: new BngReference('SK', '1872', '8513') }

const details = {
  bngRef: 'SK18728513',
  landCover: { label: 'Improved grassland', code: 'C021', source: 'UKCEH', date: new Date(2023, 2, 8) },
  landUse: { label: 'Agriculture', code: 'U011' },
  soil: { label: 'Brown soils', code: 'S011', source: 'Cranfield', date: null },
  topography: { source: 'LIDAR', date: null },
  elevation: { min: 1, mean: 2, mode: null, max: 3 },
  slope: { min: 0, mean: null, mode: 1, max: 2 },
  aspect: { mean: null, label: 'FLAT' }
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

describe('CellInfo', () => {
  test('shows the grid reference and a section per attribute group', () => {
    view = mount(<CellInfo hit={hit} details={details} />)
    const text = view.container.textContent

    expect(text).toContain('SK 1872 8513')
    expect(text).toContain('Improved grassland')
    expect(text).toContain('Agriculture')
    expect(text).toContain('Brown soils')
    expect(text).toContain('2023-03-08')

    const titles = [...view.container.querySelectorAll('.app-map__info-section-title')]
    expect(titles.map(title => title.textContent)).toEqual(['Land cover', 'Land use', 'Soils'])
  })

  test('sections start collapsed', () => {
    view = mount(<CellInfo hit={hit} details={details} />)

    expect([...view.container.querySelectorAll('details')].every(section => !section.open)).toBe(true)
  })

  test('falls back to a dash for missing values', () => {
    view = mount(<CellInfo hit={hit} details={{ ...details, soil: { ...details.soil, label: null, code: null } }} />)

    expect(view.container.textContent).toContain('-')
  })

  test('offers the sample area when the cell has no data', () => {
    view = mount(<CellInfo hit={hit} details={null} />)

    expect(view.container.textContent).toContain('SK 1872 8513')
    expect(view.container.textContent).toContain('This grid cell is not covered by the sample land model.')
    expect(view.container.querySelector('button').textContent).toBe('Go to the sample area')
  })
})
