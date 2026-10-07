// @vitest-environment jsdom
import { describe, test, expect, vi } from 'vitest'
import { render, fireEvent, act } from '@testing-library/preact'
import { InfoPanelContext } from '../../panels/info/context.js'
import { grid10mRecord, grid100mRecord, grid1kmRecord, featureRecord, featureMultipleRecord, zeroRecord, partialRecord } from '../fixtures/land-model.js'
import { LandSummaryView } from './LandSummaryView.jsx'

function mount (record, sections = new Map(), extra = {}) {
  const goToSampleArea = vi.fn()
  return {
    ...render(<InfoPanelContext.Provider value={{ sections, goToSampleArea }}><LandSummaryView record={record} {...extra} /></InfoPanelContext.Provider>),
    goToSampleArea
  }
}

function section (view, title) {
  return [...view.container.querySelectorAll('.app-map__summary-section')].find(node => node.querySelector('.app-map__summary-section-title').textContent === title)
}

function previews (record, extra) {
  const view = mount(record, new Map(), extra)
  const values = Object.fromEntries([...view.container.querySelectorAll('.app-map__summary-section')].map(node => [
    node.querySelector('.app-map__summary-section-title').textContent,
    node.querySelector('.app-map__summary-section-value').textContent
  ]))
  view.unmount()
  return values
}

describe('collapsed previews', () => {
  test('shows the dominant class with or without intersections', () => {
    expect(previews({
      ...grid10mRecord,
      landCover: { dominant: { label: 'Water' }, intersections: [{ label: 'Woodland', percentage: 50 }, { label: 'Water', percentage: 50 }] },
      landUse: { dominant: { label: 'Unused land' } }
    })).toMatchObject({ 'Land cover': 'Water', 'Land use': 'Unused land' })
  })

  test('uses a single record label or the record count', () => {
    expect(previews({
      ...grid10mRecord,
      ownership: { titles: [{ inspireId: '00001', titleDescriptor: 'Rentcharge' }] },
      landManagement: { records: [{ pseudoSbi: '00123' }] }
    })).toMatchObject({ Ownership: 'Rentcharge', 'Land management': '00123' })
    expect(previews({
      ...grid10mRecord,
      ownership: { titles: [{ inspireId: '00001' }] },
      landManagement: { records: [{ pseudoSbi: '00123' }, { pseudoSbi: '00124' }] }
    })).toMatchObject({ Ownership: '1 title', 'Land management': '2 holdings' })
  })

  test('counts protected sites when supplied and the supplied count otherwise', () => {
    expect(previews({ ...grid10mRecord, protectedAreas: { count: 1 } })).toMatchObject({ 'Protected areas': '1 designation' })
    expect(previews({ ...grid10mRecord, protectedAreas: { count: 5, sites: featureMultipleRecord.protectedAreas.sites } })).toMatchObject({ 'Protected areas': '2 designations' })
  })

  test('shows None for empty data and Not available for missing data', () => {
    expect(previews({
      ...grid10mRecord,
      ownership: { titles: [] },
      landManagement: { records: [] },
      protectedAreas: { sites: [] }
    })).toMatchObject({ Ownership: 'None', 'Land management': 'None', 'Protected areas': 'None' })
    expect(Object.values(previews(null, { unit: featureRecord.unit }))).toEqual(Array(6).fill('Not available'))
  })
})

describe('LandSummaryView', () => {
  test('opens INSPIRE information beside the label and dismisses it without closing ownership', async () => {
    const view = mount(grid10mRecord)
    const ownership = section(view, 'Ownership')
    const button = view.getAllByRole('button', { name: 'About INSPIRE IDs' })[0]
    expect(button.closest('dt').textContent).toBe('INSPIRE ID')
    expect(view.queryByRole('dialog')).toBeNull()

    act(() => button.focus())
    fireEvent.click(button)
    const popup = await view.findByRole('dialog', { name: 'About INSPIRE IDs' })
    expect(popup.textContent).toBe('Use this ID to search the Land Registry for the registered title. It identifies the polygon, not the owner.')
    expect(document.getElementById(popup.getAttribute('aria-describedby')).textContent).toBe(popup.textContent)
    await vi.waitFor(() => expect(document.activeElement).toBe(popup))

    fireEvent.keyDown(popup, { key: 'Escape' })
    await vi.waitFor(() => expect(view.queryByRole('dialog')).toBeNull())
    await vi.waitFor(() => expect(document.activeElement).toBe(button))
    expect(ownership.open).toBe(true)
    view.unmount()
  })

  test('explains INSPIRE IDs beside the count when titles are listed', async () => {
    const view = mount(grid1kmRecord)
    const button = view.getByRole('button', { name: 'About INSPIRE IDs' })
    expect(button.closest('dt').textContent).toBe('INSPIRE IDs')

    fireEvent.click(button)
    const popup = await view.findByRole('dialog', { name: 'About INSPIRE IDs' })
    expect(section(view, 'Ownership').contains(popup)).toBe(true)
    view.unmount()
  })

  test.each([grid10mRecord, grid100mRecord, featureRecord, featureMultipleRecord, partialRecord])('renders all six sections open', (summary) => {
    const view = mount(summary)
    const nodes = [...view.container.querySelectorAll('.app-map__summary-section')]
    expect(nodes.map(node => node.querySelector('.app-map__summary-section-title').textContent)).toEqual(['Land cover', 'Land use', 'Ownership', 'Land management', 'Protected areas', 'Soils'])
    expect(nodes.every(node => node.open)).toBe(true)
    expect(view.container.querySelectorAll('.app-map__summary-definition a')).toHaveLength(6)
    view.unmount()
  })

  test('remembers closed sections across panels, ignoring ID list toggles', () => {
    const preferences = new Map()
    const first = mount(grid100mRecord, preferences)
    const ownership = section(first, 'Ownership')
    const ids = ownership.querySelector('.app-map__summary-id-list')
    ids.open = true
    fireEvent(ids, new Event('toggle'))
    expect(preferences.size).toBe(0)
    ownership.open = false
    fireEvent(ownership, new Event('toggle'))
    expect(preferences.get('ownership')).toBe(false)
    first.unmount()

    const second = mount(featureRecord, preferences)
    expect(section(second, 'Ownership').open).toBe(false)
    expect(section(second, 'Land cover').open).toBe(true)
    second.unmount()
  })

  test('renders each ID list only while its own disclosure is open', () => {
    const view = mount(grid100mRecord)
    const ownership = section(view, 'Ownership').querySelector('.app-map__summary-id-list')
    const management = section(view, 'Land management').querySelector('.app-map__summary-id-list')
    const ids = details => [...details.querySelectorAll('li > span:first-child')].map(node => node.textContent)
    const toggle = (details, open) => {
      details.open = open
      fireEvent(details, new Event('toggle'))
    }

    expect(ids(ownership)).toEqual([])
    expect(ids(management)).toEqual([])

    toggle(ownership, true)
    expect(ids(ownership)).toEqual(grid100mRecord.ownership.titles.map(title => title.inspireId))
    expect(ids(management)).toEqual([])
    expect(management.open).toBe(false)

    toggle(management, true)
    toggle(ownership, false)
    expect(ids(ownership)).toEqual([])
    expect(ids(management)).toEqual(grid100mRecord.landManagement.records.map(record => record.pseudoSbi))
    expect(management.open).toBe(true)

    toggle(ownership, true)
    expect(ids(ownership)).toEqual(grid100mRecord.ownership.titles.map(title => title.inspireId))
    expect(ids(management)).toEqual(grid100mRecord.landManagement.records.map(record => record.pseudoSbi))
    view.unmount()
  })

  test('lists INSPIRE IDs with their title descriptors', () => {
    const titles = [
      { inspireId: '000001', titleDescriptor: 'Commonhold' },
      { inspireId: '000002', titleDescriptor: 'Rentcharge' },
      { inspireId: '000003', titleDescriptor: 'Freehold' }
    ]
    const view = mount({ ...grid100mRecord, ownership: { titles } })
    const ownership = section(view, 'Ownership')
    const disclosure = ownership.querySelector('.app-map__summary-id-list')
    expect(disclosure.textContent).toBe('Show all 3 INSPIRE IDs')
    expect(ownership.querySelector('.app-map__summary-id-scroll')).toBeNull()

    disclosure.open = true
    fireEvent(disclosure, new Event('toggle'))
    const scrollArea = view.getByRole('region', { name: 'INSPIRE IDs list' })
    expect(scrollArea.tabIndex).toBe(0)
    expect([...scrollArea.querySelectorAll('li')].map(row => [...row.children].map(node => node.textContent))).toEqual(titles.map(title => [title.inspireId, title.titleDescriptor]))

    disclosure.open = false
    fireEvent(disclosure, new Event('toggle'))
    expect(view.queryByRole('region', { name: 'INSPIRE IDs list' })).toBeNull()
    view.unmount()
  })

  test('shows a single title and Pseudo SBI as a record with its own provenance', () => {
    const source = { name: 'Record-specific source', updated: new Date(2022, 8, 21) }
    const summary = {
      ...grid10mRecord,
      ownership: {
        titles: [{ inspireId: '000001', titleDescriptor: 'Leasehold', source }],
        source: { name: 'Default titles' }
      },
      landManagement: {
        records: [{ pseudoSbi: '0000123', refreshed: new Date(2022, 8, 21) }],
        source: { name: 'Default holdings' }
      }
    }
    const view = mount(summary)
    const ownership = section(view, 'Ownership')
    expect(ownership.textContent).toContain('INSPIRE ID000001')
    expect(ownership.textContent).toContain('Title descriptorLeasehold')
    expect(ownership.textContent).toContain('Record-specific source')
    expect(ownership.textContent).not.toContain('Default titles')
    expect(ownership.textContent).toContain('Last updated2022')
    const management = section(view, 'Land management')
    expect(management.textContent).toContain('Pseudo SBI0000123')
    expect(management.textContent).toContain('Default holdings')
    expect(management.textContent).toContain('Last updated2022')
    expect(view.container.querySelectorAll('.app-map__summary-id-list')).toHaveLength(0)
    view.unmount()
  })

  test('lists multiple ID-only titles and holdings', () => {
    const ids = ['000001', '000002', '000003']
    const view = mount({
      ...grid100mRecord,
      ownership: { titles: ids.map(inspireId => ({ inspireId })), source: { name: 'HM Land Registry' } },
      landManagement: { records: ids.map(pseudoSbi => ({ pseudoSbi })), source: { name: 'Rural Payments Agency' } }
    })

    for (const [title, preview] of [['Ownership', '3 titles'], ['Land management', '3 holdings']]) {
      const node = section(view, title)
      expect(node.querySelector('.app-map__summary-section-value').textContent).toBe(preview)
      const disclosure = node.querySelector('.app-map__summary-id-list')
      disclosure.open = true
      fireEvent(disclosure, new Event('toggle'))
      expect([...disclosure.querySelectorAll('li')].map(row => row.textContent)).toEqual(ids)
      expect(node.textContent).toContain(title === 'Ownership' ? 'HM Land Registry' : 'Rural Payments Agency')
    }

    view.unmount()
  })

  test('shows whichever of source name and date is present', () => {
    const view = mount({
      ...featureRecord,
      landCover: { ...featureRecord.landCover, source: {} },
      soils: { ...featureRecord.soils, source: { name: '', updated: new Date(2024, 0, 1) } },
      landManagement: { records: [{ pseudoSbi: '0000123' }] }
    })
    expect(section(view, 'Land cover').textContent).not.toContain('Last updated')
    expect(section(view, 'Land cover').textContent).not.toContain('Data source')
    expect(section(view, 'Soils').textContent).toContain('Last updated2024')
    expect(section(view, 'Soils').textContent).not.toContain('Data source')
    expect(section(view, 'Land management').textContent).not.toContain('Last updated')
    view.unmount()
  })

  test('shows each intersection with its percentage and the rounding hint', () => {
    const summary = {
      ...featureRecord,
      landUse: {
        dominant: { label: 'Water storage' },
        intersections: [
          { label: 'Water storage', percentage: 60.3 },
          { label: 'Treatment', percentage: 33.4 }
        ],
        source: { name: 'OS NGD', updated: new Date(2024, 0, 1) }
      }
    }
    const view = mount(summary)
    const use = section(view, 'Land use')
    expect(use.textContent).toContain('Water storage')
    expect(use.textContent).toContain('Treatment')
    expect(use.textContent).toContain('Share of area')
    expect([...use.querySelectorAll('.app-map__summary-percentage')].map(node => node.textContent)).toEqual(['60.3%', '33.4%'])
    const tracks = [...use.querySelectorAll('.app-map__summary-track')]
    expect(tracks.every(node => node.getAttribute('aria-hidden') === 'true')).toBe(true)
    expect(tracks.map(node => node.firstElementChild.style.width)).toEqual(['60.3%', '33.4%'])
    expect(use.querySelector('.govuk-hint').textContent).toBe('*Percentages may not add up to 100% due to rounding.')
    view.unmount()
  })

  test('orders intersections by largest share and scales them against it without reordering the record', () => {
    const intersections = [
      { label: 'Treatment', percentage: 33.4 },
      { label: 'Water storage', percentage: 60.3 },
      { label: 'Offices', percentage: 6.3 }
    ]
    const view = mount({ ...featureRecord, landUse: { dominant: { label: 'Water storage' }, intersections } })
    const use = section(view, 'Land use')
    expect([...use.querySelectorAll('.app-map__summary-proportion > span:first-child')].map(node => node.textContent)).toEqual(['Water storage', 'Treatment', 'Offices'])
    expect([...use.querySelectorAll('.app-map__summary-percentage')].map(node => node.textContent)).toEqual(['60.3%', '33.4%', '6.3%'])
    expect(use.querySelector('.app-map__summary-bar').style.opacity).toBe('1')
    expect(intersections.map(entry => entry.label)).toEqual(['Treatment', 'Water storage', 'Offices'])
    view.unmount()
  })

  test.each([zeroRecord, { ...zeroRecord, protectedAreas: { sites: [], source: zeroRecord.protectedAreas.source } }])('shows None for zero titles, holdings and protected areas', (record) => {
    const zero = mount(record)
    const protection = section(zero, 'Protected areas')
    expect(protection.querySelector('.app-map__summary-section-value').textContent).toBe('None')
    expect(protection.querySelector('.app-map__summary-empty-message').textContent).toBe('Not in a protected area.')
    expect(protection.querySelector('.govuk-summary-list__value').textContent).toBe('0')
    expect([...protection.querySelectorAll('.govuk-summary-list__key')].map(node => node.textContent)).toEqual(['Count', 'Last updated', 'Data source'])
    for (const title of ['Ownership', 'Land management']) {
      expect(section(zero, title).querySelector('.app-map__summary-empty-message').textContent).toBe('None')
      expect(section(zero, title).textContent).toContain('Data source')
    }
    expect(zero.container.querySelectorAll('.app-map__summary-id-list')).toHaveLength(0)
    zero.unmount()
  })

  test('shows Not available for every section when there is no record', () => {
    const missing = mount(null, new Map(), { unit: featureRecord.unit, outsideSampleArea: true })
    expect(missing.container.querySelectorAll('.app-map__summary-message')).toHaveLength(6)
    expect([...missing.container.querySelectorAll('.app-map__summary-message')].every(node => node.textContent === 'Not available')).toBe(true)
    expect(missing.container.querySelectorAll('.app-map__summary-definition a')).toHaveLength(6)
    fireEvent.click(missing.getByRole('button', { name: 'Go to the sample area' }))
    expect(missing.goToSampleArea).toHaveBeenCalledOnce()
    missing.unmount()
  })

  test('shows a dominant class without provenance', () => {
    const summary = { ...grid10mRecord, landUse: { dominant: { label: 'Unused land' } } }
    const view = mount(summary)
    const use = section(view, 'Land use')
    expect(use.textContent).toContain('Land useUnused land')
    expect(section(view, 'Soils').textContent).toContain('Soil typeBrown soils')
    expect(use.textContent).not.toContain('Data source')
    expect(use.textContent).not.toContain('Last updated')
    view.unmount()
  })

  test('renders detailed protected-site facts and their boundary caveat', () => {
    const view = mount(featureMultipleRecord)
    const protection = section(view, 'Protected areas')
    expect(protection.querySelector('.app-map__summary-section-value').textContent).toBe('2 designations')
    for (const site of featureMultipleRecord.protectedAreas.sites) {
      expect(protection.textContent).toContain(site.name)
      expect(protection.textContent).toContain(site.code)
      expect(protection.textContent).toContain(site.designation.label)
      expect(protection.textContent).toContain(`${site.intersection.percentage}%`)
    }
    expect(protection.textContent).toContain('Refer to the source dataset for the legal boundary.')
    expect(protection.textContent).toContain('Data source')
    view.unmount()
  })

  test('shows the grid size', () => {
    const view = mount(grid1kmRecord)
    expect(view.container.querySelector('.app-map__summary-size').textContent).toBe('1km x 1km')
    view.unmount()
  })

  test('omits TOID when not supplied', () => {
    const view = mount(null, new Map(), { unit: { kind: 'feature', osid: '000-feature' } })
    expect(view.container.querySelector('header').textContent).toContain('OSID000-feature')
    expect(view.container.querySelector('header').textContent).not.toContain('TOID')
    view.unmount()
  })

  test('renders whatever detail the data supplies', () => {
    const richer = mount({
      ...grid10mRecord,
      landCover: { ...grid10mRecord.landCover, intersections: [{ label: 'Other cover', percentage: 50 }] },
      protectedAreas: { ...grid10mRecord.protectedAreas, sites: featureRecord.protectedAreas.sites }
    })
    expect(section(richer, 'Land cover').querySelector('.app-map__summary-proportions')).not.toBeNull()
    expect(section(richer, 'Protected areas').textContent).toContain(featureRecord.protectedAreas.sites[0].name)
    richer.unmount()

    const dominantOnly = mount({ ...grid1kmRecord, landCover: { dominant: { label: 'Urban' } }, protectedAreas: { count: 2 } })
    expect(section(dominantOnly, 'Land cover').textContent).toContain('Dominant coverUrban')
    expect(section(dominantOnly, 'Protected areas').textContent).toContain('Count2')
    dominantOnly.unmount()
  })

  test('copies the identifier and announces the result', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    try {
      const view = mount(grid10mRecord)
      const button = view.getByRole('button', { name: /^Copy grid reference / })
      fireEvent.click(button)
      await vi.waitFor(() => expect(view.getByRole('status').textContent).toBe('grid reference copied'))
      expect(writeText).toHaveBeenCalledWith(button.querySelector('span').textContent)
      writeText.mockRejectedValue(new Error('Denied'))
      fireEvent.click(button)
      await vi.waitFor(() => expect(view.getByRole('status').textContent).toContain('Could not copy grid reference'))
      view.unmount()
    } finally {
      if (original) {
        Object.defineProperty(navigator, 'clipboard', original)
      } else {
        delete navigator.clipboard
      }
    }
  })
})
