// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/preact'

vi.mock('../../datasets/layer-manager.js', () => ({ toggleDataset: vi.fn() }))

const { toggleDataset } = await import('../../datasets/layer-manager.js')
const { LayersPanel } = await import('./LayersPanel.jsx')

const DATASETS = [
  { id: 'woodland', label: 'Ancient Woodland' },
  { id: 'flood', label: 'Flood Zones' },
  { id: 'peat', label: 'Peaty Soils' }
]

let view
let announce
let dispatch
let inspection
const map = { id: 'map' }

function renderPanel (state = {}) {
  const pluginState = {
    datasets: state.datasets ?? {},
    summaries: state.summaries ?? {},
    query: state.query ?? '',
    dispatch,
    useRef: () => ({ current: inspection })
  }

  view = render(
    <LayersPanel
      mapProvider={{ map }}
      pluginConfig={{ datasets: DATASETS }}
      pluginState={pluginState}
      services={{ announce }}
    />
  )
  return view
}

const labels = () => [...view.container.querySelectorAll('.govuk-checkboxes__label')]
  .map(label => label.textContent.trim())

beforeEach(() => {
  announce = vi.fn()
  dispatch = vi.fn()
  inspection = { reconcile: vi.fn() }
  vi.mocked(toggleDataset).mockResolvedValue({ visible: true, minZoom: 9 })
})

describe('LayersPanel', () => {
  test('lists datasets alphabetically after the land summary toggles', () => {
    renderPanel()

    expect(labels()).toEqual(['Grid squares', 'OS features', 'Ancient Woodland', 'Flood Zones', 'Peaty Soils'])
  })

  test('filters the list to the search term', () => {
    renderPanel({ query: '  FLOOD ' })

    expect(labels()).toEqual(['Grid squares', 'OS features', 'Flood Zones'])
    expect(view.container.querySelector('[data-app-layer-empty]').hidden).toBe(true)
  })

  test('shows and announces when the search matches nothing', () => {
    renderPanel({ query: 'nothing' })

    const empty = view.container.querySelector('[data-app-layer-empty]')
    expect(empty.hidden).toBe(false)
    expect(empty.textContent.trim()).toBe('No layers match your search.')
    expect(announce).toHaveBeenCalledWith('No layers match your search.')
  })

  test('submitting and clearing search delegates the panel-local query', () => {
    renderPanel({ query: 'wood' })
    const input = view.container.querySelector('#layers-search')

    input.value = 'flood'
    view.container.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_QUERY', payload: 'flood' })

    input.value = ''
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_QUERY', payload: '' })
  })

  test('checking a dataset updates the optimistic state then commits the map result', async () => {
    renderPanel()
    const input = view.container.querySelector('#layer-woodland')

    input.checked = true
    input.dispatchEvent(new window.Event('change', { bubbles: true }))

    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_DATASET_LOADING',
      payload: { id: 'woodland', visible: true }
    })
    expect(toggleDataset).toHaveBeenCalledWith(map, DATASETS[0], true)
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_DATASET_STATE',
      payload: { id: 'woodland', visible: true, minZoom: 9 }
    }))
    expect(inspection.reconcile).toHaveBeenCalledTimes(1)
  })

  test('a loading dataset keeps its requested state and is marked busy', () => {
    renderPanel({ datasets: { woodland: { visible: true, loading: true } } })

    const input = view.container.querySelector('#layer-woodland')
    expect(input.checked).toBe(true)
    expect(input.disabled).toBe(true)
    expect(input.closest('.govuk-checkboxes__item').getAttribute('aria-busy')).toBe('true')
  })

  test('a dataset that failed to load is left unchecked', () => {
    renderPanel({ datasets: { woodland: { visible: false, loading: false } } })

    expect(view.container.querySelector('#layer-woodland').checked).toBe(false)
  })

  test('land summaries delegate visibility and remain mutually exclusive', () => {
    renderPanel({ summaries: { grid: true } })

    expect(view.container.querySelector('#summary-grid').disabled).toBe(false)
    expect(view.container.querySelector('#summary-features').disabled).toBe(true)

    const input = view.container.querySelector('#summary-grid')
    input.checked = false
    input.dispatchEvent(new window.Event('change', { bubbles: true }))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_SUMMARY',
      payload: { id: 'grid', visible: false }
    })
  })
})
