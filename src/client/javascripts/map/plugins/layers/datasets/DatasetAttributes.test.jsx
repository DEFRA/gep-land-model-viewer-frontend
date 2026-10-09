// @vitest-environment jsdom
import { describe, test, expect } from 'vitest'
import { render } from '@testing-library/preact'
import { DatasetAttributes } from './DatasetAttributes.jsx'
import { InfoPanelContext } from '../panels/info/context.js'

let view

function values () {
  return [...view.container.querySelectorAll('.govuk-summary-list__value')].map(node => node.textContent)
}

describe('DatasetAttributes', () => {
  test('lists one summary list per feature', () => {
    view = render(<DatasetAttributes label='Ancient Woodland' features={[{ name: 'Wood A' }, { name: 'Wood B' }]} />)

    expect(view.container.textContent).toContain('Ancient Woodland')
    expect(view.container.querySelectorAll('.app-map__info-attributes')).toHaveLength(2)
    expect(values()).toEqual(['Wood A', 'Wood B'])
  })

  test.each([
    { case: 'no features', features: [] },
    { case: 'only blank values', features: [{ name: null, code: '' }, {}] }
  ])('says so when the click found $case', ({ features }) => {
    view = render(<DatasetAttributes label='Ancient Woodland' features={features} />)

    expect(view.container.textContent).toContain('No attributes found at this location.')
    expect(view.container.querySelectorAll('.app-map__info-attributes')).toHaveLength(0)
  })

  test('skips features with only blank values alongside ones that have attributes', () => {
    view = render(<DatasetAttributes label='SSSI' features={[{ name: null }, { name: 'Site' }]} />)

    expect(view.container.querySelectorAll('.app-map__info-attributes')).toHaveLength(1)
    expect(values()).toEqual(['Site'])
  })

  test('drops missing and empty values', () => {
    view = render(<DatasetAttributes label='SSSI' features={[{ name: 'Site', code: null, note: '' }]} />)

    expect(values()).toEqual(['Site'])
  })

  test('shows values the source did not store as text', () => {
    const features = [{ notified: true, cleared: false, count: 0, parts: [1, 2], extra: { a: 1 } }]
    view = render(<DatasetAttributes label='SSSI' features={features} />)

    expect(values()).toEqual(['true', 'false', '0', '[1,2]', '{"a":1}'])
  })
  test.each([
    { case: 'attributes', features: [{ name: 'Site' }] },
    { case: 'no attributes', features: [] }
  ])('links to the full dataset when it has $case', ({ features }) => {
    view = render(
      <InfoPanelContext.Provider value={{ findGeoDataUrl: 'https://find-geo-data.example.test/' }}>
        <DatasetAttributes label='SSSI' features={features} datasetId='sssi' />
      </InfoPanelContext.Provider>
    )

    const link = view.getByRole('link', { name: 'View full dataset (opens in new tab)' })
    expect(link.getAttribute('href')).toBe('https://find-geo-data.example.test/dataset/sssi')
    expect(link.getAttribute('target')).toBe('_blank')
  })

  test.each([
    { case: 'no dataset id', context: { findGeoDataUrl: 'https://find-geo-data.example.test/' }, datasetId: undefined },
    { case: 'no find geo data url', context: {}, datasetId: 'sssi' },
    { case: 'no info panel', context: null, datasetId: 'sssi' }
  ])('omits the link when there is $case', ({ context, datasetId }) => {
    view = render(
      <InfoPanelContext.Provider value={context}>
        <DatasetAttributes label='SSSI' features={[]} datasetId={datasetId} />
      </InfoPanelContext.Provider>
    )

    expect(view.container.querySelector('a')).toBeNull()
  })
})
