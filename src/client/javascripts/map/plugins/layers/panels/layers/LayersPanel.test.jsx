// @vitest-environment jsdom
import '../contents/test-helpers/browser-mocks.js'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { useReducer } from 'react'
import { act, fireEvent, render } from '@testing-library/preact'
import { initialState, actions } from '../../reducer.js'
import { DATASET_INFO_PANEL_ID } from '../../constants.js'
import { LayersPanel } from './LayersPanel.jsx'

const DATASETS = [
  { id: 'peat', label: 'Peaty Soils', inspireTheme: 'Soil' },
  { id: 'habitats', label: 'Meadow habitats', inspireTheme: 'Habitats and biotopes' },
  { id: 'woodland', label: 'Ancient Woodland', inspireTheme: 'Habitats and biotopes' },
  { id: 'flood', label: 'Flood Zones', inspireTheme: 'Natural risk zones' }
]

let view
let announce
let dispatch
let appDispatch
let updateState

function TestPanel ({ initial = {}, visible = true }) {
  const [state, reduce] = useReducer((state, { type, payload }) => actions[type](state, payload), { ...initialState, ...initial })
  updateState = reduce

  return visible && (
    <LayersPanel
      pluginConfig={{ datasets: DATASETS }}
      pluginState={{
        ...state,
        dispatch: action => {
          dispatch(action)
          reduce(action)
        }
      }}
      services={{ announce }}
      appState={{ dispatch: appDispatch }}
    />
  )
}

function renderPanel (state = {}) {
  view = render(<TestPanel initial={state} />)
  return view
}

const labels = () => [...view.container.querySelectorAll('.govuk-checkboxes__label')]
  .map(label => label.textContent.trim())
const datasetTheme = name => view.getByText(name, { selector: '.govuk-details__summary-text' }).closest('details')
const count = name => datasetTheme(name).querySelector('.app-map__dataset-theme-count').textContent.trim()

beforeEach(() => {
  announce = vi.fn()
  dispatch = vi.fn()
  appDispatch = vi.fn()
})

describe('LayersPanel', () => {
  test.each([
    { list: 'grouped list', query: '' },
    { list: 'search results', query: 'wood' }
  ])('opens dataset information from the $list', ({ query }) => {
    renderPanel({
      query,
      expandedDatasetThemes: ['Habitats and biotopes']
    })
    const button = view.getByRole('button', { name: 'About Ancient Woodland' })
    fireEvent.click(button)

    expect(button.getAttribute('aria-haspopup')).toBe('dialog')
    expect(appDispatch).toHaveBeenCalledWith({
      type: 'OPEN_PANEL',
      payload: {
        panelId: DATASET_INFO_PANEL_ID,
        props: { datasetId: 'woodland', triggeringElement: button }
      }
    })
  })

  test('starts with collapsed alphabetical dataset themes and alphabetical datasets within each theme', () => {
    renderPanel()

    const groups = [...view.container.querySelectorAll('details')]
    expect(groups.map(group => group.querySelector('.govuk-details__summary-text').textContent)).toEqual([
      'Habitats and biotopes', 'Natural risk zones', 'Soil'
    ])
    expect(groups.every(group => !group.open)).toBe(true)
    expect(count('Habitats and biotopes')).toBe('2 datasets')
    expect(count('Soil')).toBe('1 dataset')
    expect(labels()).toEqual(['Grid squares', 'OS features', 'Ancient Woodland', 'Meadow habitats', 'Flood Zones', 'Peaty Soils'])
    expect(view.queryByRole('button', { name: 'Clear search' })).toBeNull()
  })

  test('remembers independently expanded dataset themes across searching and panel reopening', async () => {
    renderPanel()
    fireEvent.click(datasetTheme('Habitats and biotopes').querySelector('summary'))
    fireEvent.click(datasetTheme('Soil').querySelector('summary'))
    await vi.waitFor(() => expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_DATASET_THEME_EXPANDED', payload: { datasetTheme: 'Soil', expanded: true }
    }))

    fireEvent.input(view.getByRole('searchbox'), { target: { value: 'flood' } })
    expect(view.container.querySelector('details')).toBeNull()
    fireEvent.click(view.getByText('Clear search', { selector: 'button' }))
    expect(datasetTheme('Habitats and biotopes').open).toBe(true)
    expect(datasetTheme('Soil').open).toBe(true)
    expect(datasetTheme('Natural risk zones').open).toBe(false)

    view.rerender(<TestPanel visible={false} />)
    view.rerender(<TestPanel />)
    expect(datasetTheme('Habitats and biotopes').open).toBe(true)
    expect(datasetTheme('Soil').open).toBe(true)

    fireEvent.click(datasetTheme('Soil').querySelector('summary'))
    await vi.waitFor(() => expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_DATASET_THEME_EXPANDED', payload: { datasetTheme: 'Soil', expanded: false }
    }))
    expect(datasetTheme('Soil').open).toBe(false)
    expect(datasetTheme('Habitats and biotopes').open).toBe(true)
  })

  test('filters dataset names as text is entered, ignoring case and surrounding whitespace', () => {
    renderPanel()
    fireEvent.input(view.getByRole('searchbox'), { target: { value: '  FLOOD ' } })

    expect(labels()).toEqual(['Grid squares', 'OS features', 'Flood Zones'])
    expect(view.container.querySelector('details')).toBeNull()
    expect(view.container.querySelector('[data-app-layer-empty]').hidden).toBe(true)
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_QUERY', payload: '  FLOOD ' })
  })

  test('shows grouped dataset themes for whitespace-only input', () => {
    renderPanel({ query: '  ' })

    expect(view.container.querySelectorAll('details')).toHaveLength(3)
    expect(view.container.querySelector('[data-app-layer-empty]').hidden).toBe(true)
  })

  test('shows and announces no matches when the query matches only a dataset theme name', () => {
    renderPanel({ query: '  Natural risk  ' })

    const empty = view.container.querySelector('[data-app-layer-empty]')
    expect(empty.hidden).toBe(false)
    expect(empty.textContent.trim()).toBe('No datasets match "Natural risk"')
    expect(announce).toHaveBeenCalledWith('No datasets match "Natural risk"')
    expect(labels()).toEqual(['Grid squares', 'OS features'])
    expect(view.container.querySelector('details')).toBeNull()

    fireEvent.input(view.getByRole('searchbox'), { target: { value: 'Unknown' } })
    expect(empty.textContent.trim()).toBe('No datasets match "Unknown"')
    expect(announce).toHaveBeenLastCalledWith('No datasets match "Unknown"')
  })

  test.each(['inline', 'below results'])('%s clear control clears a search and returns to the existing input', (position) => {
    renderPanel({ query: 'wood' })
    const input = view.getByRole('searchbox')
    const clear = position === 'inline'
      ? view.getByRole('search').querySelector('button')
      : view.getByText('Clear search', { selector: 'button' })

    clear.focus()
    fireEvent.click(clear)

    expect(input.value).toBe('')
    expect(view.getByRole('searchbox')).toBe(input)
    expect(document.activeElement).toBe(input)
    expect(view.container.querySelectorAll('details')).toHaveLength(3)
    expect(view.queryByRole('button', { name: 'Clear search' })).toBeNull()
  })

  test('clearing by deleting the input text restores grouped dataset themes', () => {
    renderPanel({ query: 'wood' })
    fireEvent.input(view.getByRole('searchbox'), { target: { value: '' } })

    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_QUERY', payload: '' })
    expect(view.container.querySelectorAll('details')).toHaveLength(3)
  })

  test('selection in search results is retained and counted after clearing', () => {
    renderPanel({ query: 'wood' })
    fireEvent.click(view.getByRole('checkbox', { name: 'Ancient Woodland' }))

    expect(dispatch).toHaveBeenCalledWith({ type: 'DATASET_LOADING', payload: { id: 'woodland' } })
    fireEvent.click(view.getByText('Clear search', { selector: 'button' }))
    expect(count('Habitats and biotopes')).toBe('1 of 2 selected')
    expect(view.container.querySelector('#layer-woodland').checked).toBe(true)
  })

  test('keeps focus during loading, prevents repeat activation and allows removal when ready', () => {
    renderPanel({ expandedDatasetThemes: ['Habitats and biotopes'] })
    const input = view.getByRole('checkbox', { name: 'Ancient Woodland' })
    input.focus()
    fireEvent.click(input)

    expect(input.checked).toBe(true)
    expect(input.disabled).toBe(false)
    expect(input.getAttribute('aria-disabled')).toBe('true')
    expect(document.activeElement).toBe(input)

    fireEvent.click(input)
    expect(input.checked).toBe(true)
    expect(dispatch).toHaveBeenCalledTimes(1)

    act(() => updateState({ type: 'DATASET_LOADED', payload: { id: 'woodland' } }))
    expect(input.hasAttribute('aria-disabled')).toBe(false)
    expect(document.activeElement).toBe(input)
    fireEvent.click(input)

    expect(dispatch).toHaveBeenCalledWith({ type: 'REMOVE_LAYER', payload: { id: 'woodland' } })
    expect(count('Habitats and biotopes')).toBe('2 datasets')
  })

  test('counts loading and hidden datasets, excludes summaries and updates when a failed layer is removed', () => {
    renderPanel({
      layers: [{ id: 'woodland', ready: false }, { id: 'habitats', ready: true, hidden: true }, { id: 'grid', ready: true }]
    })

    expect(count('Habitats and biotopes')).toBe('2 of 2 selected')
    expect(count('Soil')).toBe('1 dataset')
    const input = view.container.querySelector('#layer-woodland')
    expect(input.checked).toBe(true)
    expect(input.getAttribute('aria-disabled')).toBe('true')
    expect(input.closest('.govuk-checkboxes__item').getAttribute('aria-busy')).toBe('true')

    act(() => updateState({ type: 'REMOVE_LAYER', payload: { id: 'woodland' } }))
    expect(count('Habitats and biotopes')).toBe('1 of 2 selected')
    expect(view.container.querySelector('#layer-woodland').checked).toBe(false)
  })

  test('land summaries delegate enabled state and remain mutually exclusive', () => {
    renderPanel({ layers: [{ id: 'grid', ready: true }] })

    expect(view.container.querySelector('#summary-grid').disabled).toBe(false)
    expect(view.container.querySelector('#summary-features').disabled).toBe(true)
    fireEvent.click(view.getByRole('checkbox', { name: 'Grid squares' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_SUMMARY', payload: { id: 'grid', enabled: false } })
  })

  test('opens summary information on activation and dismisses it with Escape without closing the panel', async () => {
    renderPanel()
    const button = view.getByRole('button', { name: 'About Grid squares' })
    const panelKeyDown = vi.fn()
    view.container.addEventListener('keydown', panelKeyDown)

    act(() => button.focus())
    fireEvent.mouseEnter(button)
    expect(view.queryByRole('dialog')).toBeNull()

    fireEvent.click(button)
    const popup = await view.findByRole('dialog', { name: 'About Grid squares' })
    expect(popup.textContent).toBe('Uniform squares based on the British National Grid.')
    expect(document.getElementById(popup.getAttribute('aria-describedby')).textContent).toBe(popup.textContent)
    expect(popup.closest('.app-map__land-summary')).toBeTruthy()
    await vi.waitFor(() => expect(document.activeElement).toBe(popup))

    fireEvent.keyDown(popup, { key: 'Escape' })
    await vi.waitFor(() => expect(view.queryByRole('dialog')).toBeNull())
    expect(panelKeyDown).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(document.activeElement).toBe(button))
  })

  test('shows information for either land summary when one is selected', async () => {
    renderPanel({ layers: [{ id: 'grid', ready: true }] })
    const gridInfo = view.getByRole('button', { name: 'About Grid squares' })
    const featuresInfo = view.getByRole('button', { name: 'About OS features' })

    fireEvent.click(featuresInfo)
    expect((await view.findByRole('dialog', { name: 'About OS features' })).textContent)
      .toBe('Real-world boundaries derived from Ordnance Survey.')

    fireEvent.click(gridInfo)
    await view.findByRole('dialog', { name: 'About Grid squares' })
    expect(view.getAllByRole('dialog')).toHaveLength(1)
    expect(featuresInfo.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(gridInfo)
    await vi.waitFor(() => expect(view.queryByRole('dialog')).toBeNull())
  })

  test('keeps hidden datasets checked and visually mutes their label', () => {
    renderPanel({ layers: [{ id: 'woodland', ready: true, hidden: true }] })

    const input = view.container.querySelector('#layer-woodland')
    expect(input.checked).toBe(true)
    expect(input.getAttribute('aria-label')).toBe('Ancient Woodland, hidden')
    expect(input.nextElementSibling.querySelector('.app-map__layers-label--hidden').textContent).toBe('Ancient Woodland')
  })

  test('visually mutes the active land summary when hidden', () => {
    renderPanel({ layers: [{ id: 'grid', ready: true, hidden: true }] })

    const input = view.container.querySelector('#summary-grid')
    const label = view.container.querySelector('label[for="summary-grid"]')
    expect(input.checked).toBe(true)
    expect(input.getAttribute('aria-label')).toBe('Grid squares, hidden')
    expect(label.querySelector('.app-map__layers-label--hidden').textContent).toBe('Grid squares')
  })
})
