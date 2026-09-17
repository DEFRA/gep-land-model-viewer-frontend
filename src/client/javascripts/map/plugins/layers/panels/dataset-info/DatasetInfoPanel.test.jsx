// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/preact'
import { DatasetInfoPanel } from './DatasetInfoPanel.jsx'

function renderInfo (metadata) {
  return render(
    <DatasetInfoPanel
      datasetId='woodland'
      pluginConfig={{
        findGeoDataUrl: 'https://find-geo-data.example.test/',
        datasets: [{ id: 'woodland', label: 'Ancient Woodland', metadata }]
      }}
    />
  )
}

describe('DatasetInfoPanel', () => {
  test('shows the description, metadata and a link to the full dataset', () => {
    const view = renderInfo({
      id: 'f425f1e1-fc18-4b5a-88d8-76934125627c',
      abstract: 'First paragraph.\n\nSecond paragraph.',
      owner: 'Natural England',
      categories: ['Environment', 'Inland waters'],
      creationDate: '2013-01-01',
      updatedAt: '2026-03-15',
      geographicExtent: 'England',
      format: ['GeoPackage', 'GeoJSON']
    })

    expect(view.getByText('First paragraph.')).toBeTruthy()
    expect(view.getByText('Second paragraph.')).toBeTruthy()
    expect(view.queryByRole('button', { name: 'Show more' })).toBeNull()

    for (const [label, value] of [
      ['Source', 'Natural England'],
      ['Category', 'Environment, Inland waters'],
      ['Creation date', '01 January 2013'],
      ['Last updated', '15 March 2026'],
      ['Geographic extent', 'England'],
      ['Available file formats', 'GeoPackage, GeoJSON']
    ]) {
      const row = view.getByText(label).parentElement
      expect(row.querySelector('dd').textContent).toBe(value)
    }

    const link = view.getByRole('link', { name: 'View full dataset (opens in new tab)' })
    expect(link.href).toBe('https://find-geo-data.example.test/dataset/f425f1e1-fc18-4b5a-88d8-76934125627c')
    expect(link.target).toBe('_blank')
    expect(link.relList.contains('noopener')).toBe(true)
  })

  test('shows the full description with Show more and restores the preview with Show less', () => {
    const firstParagraph = 'This is a detailed description of the dataset. '.repeat(8).trim()
    const view = renderInfo({ abstract: `${firstParagraph}\n\nA second paragraph.` })
    const toggle = view.getByRole('button', { name: 'Show more', expanded: false })
    const content = document.getElementById(toggle.getAttribute('aria-controls'))
    const preview = content.textContent

    expect(preview.length).toBeLessThanOrEqual(303)
    expect(preview.endsWith('...')).toBe(true)

    fireEvent.click(toggle)

    const collapse = view.getByRole('button', { name: 'Show less', expanded: true })
    expect(content.textContent).toContain(firstParagraph)
    expect(content.textContent).toContain('A second paragraph.')

    fireEvent.click(collapse)

    expect(view.getByRole('button', { name: 'Show more', expanded: false })).toBeTruthy()
    expect(content.textContent).toBe(preview)
  })

  test.each([
    { description: 'missing metadata', metadata: undefined },
    { description: 'empty metadata fields', metadata: { abstract: ' \n ', categories: [], format: [], resolution: null } }
  ])('shows placeholders for $description', ({ metadata }) => {
    const view = renderInfo(metadata)

    expect([...view.container.querySelectorAll('dt')].map(element => element.textContent)).toEqual([
      'Source', 'Category', 'Creation date', 'Last updated', 'Update frequency',
      'Access level', 'Resolution', 'Geographic extent', 'Coordinate reference system',
      'Licence', 'Available file formats'
    ])
    expect([...view.container.querySelectorAll('dd')].map(element => element.textContent)).toEqual(Array(11).fill('-'))
    expect(view.container.querySelector('p')).toBeNull()
    expect(view.queryByRole('link')).toBeNull()
  })
})
