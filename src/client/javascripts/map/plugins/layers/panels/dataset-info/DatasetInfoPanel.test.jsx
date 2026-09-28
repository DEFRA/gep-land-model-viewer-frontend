// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/preact'
import { loadDatasetMetadata } from '../../datasets/api.js'
import { DatasetInfoPanel } from './DatasetInfoPanel.jsx'

vi.mock('../../datasets/api.js', () => ({ loadDatasetMetadata: vi.fn() }))

async function renderInfo (metadata) {
  loadDatasetMetadata.mockResolvedValue(metadata)
  const view = render(
    <DatasetInfoPanel
      datasetId='f425f1e1-fc18-4b5a-88d8-76934125627c'
      pluginConfig={{
        findGeoDataUrl: 'https://find-geo-data.example.test/'
      }}
    />
  )
  await vi.waitFor(() => expect(view.queryByRole('status')).toBeNull())
  return view
}

describe('DatasetInfoPanel', () => {
  test('shows the description, metadata and a link to the full dataset', async () => {
    const view = await renderInfo({
      abstract: 'First paragraph.\n\nSecond paragraph.',
      owner: 'Natural England',
      categories: ['Environment', 'Inland waters'],
      creationDate: '2013-01-01',
      updatedAt: '2026-03-15',
      places: ['England', 'Wales'],
      resolution: ['10 m', '1:10000'],
      format: ['GeoPackage', 'GeoJSON']
    })

    expect(view.getByText('First paragraph.')).toBeTruthy()
    expect(view.getByText('Second paragraph.')).toBeTruthy()
    expect(view.queryByRole('button', { name: 'Show more' })).toBeNull()

    for (const [label, value] of [
      ['Source', 'Natural England'],
      ['Categories', 'Environment, Inland waters'],
      ['Creation date', '1 January 2013'],
      ['Last updated', '15 March 2026'],
      ['Resolution', '10 m, 1:10000'],
      ['Geographic extent', 'England, Wales'],
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

  test('shows the full description with Show more and restores the preview with Show less', async () => {
    const firstParagraph = 'This is a detailed description of the dataset. '.repeat(8).trim()
    const view = await renderInfo({ abstract: `${firstParagraph}\n\nA second paragraph.` })
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
    { description: 'empty metadata fields', metadata: { abstract: ' \n ', categories: [], format: [], places: [], resolution: [] } },
    { description: 'invalid catalogue dates', metadata: { creationDate: 'unknown', updatedAt: '2026-13-99' } }
  ])('shows placeholders for $description', async ({ metadata }) => {
    const view = await renderInfo(metadata)

    expect([...view.container.querySelectorAll('dt')].map(element => element.textContent)).toEqual([
      'Source', 'Categories', 'Creation date', 'Last updated', 'Update frequency',
      'Access level', 'Resolution', 'Geographic extent', 'Coordinate reference system',
      'Licence', 'Available file formats'
    ])
    expect([...view.container.querySelectorAll('dd')].map(element => element.textContent)).toEqual(Array(11).fill('-'))
    expect(view.container.querySelectorAll('p')).toHaveLength(1)
  })
})

test('shows loading, then a failed request, and cancels it when the panel closes', async () => {
  loadDatasetMetadata.mockRejectedValue(new Error('Unavailable'))
  const view = render(<DatasetInfoPanel datasetId='peat' pluginConfig={{ findGeoDataUrl: 'https://find-geo-data.example.test/' }} />)
  const detailsHref = 'https://find-geo-data.example.test/dataset/peat'

  expect(view.getByText('Loading dataset information…')).toBeTruthy()
  expect(view.getByRole('link').href).toBe(detailsHref)
  await vi.waitFor(() => expect(view.getByText('Dataset information could not be loaded.')).toBeTruthy())
  expect(view.container.querySelector('.govuk-summary-list')).toBeNull()
  expect(view.getByRole('link').href).toBe(detailsHref)
  expect(loadDatasetMetadata).toHaveBeenCalledWith('peat', expect.any(AbortSignal))

  const signal = loadDatasetMetadata.mock.calls.at(-1)[1]
  view.unmount()
  expect(signal.aborted).toBe(true)
})
