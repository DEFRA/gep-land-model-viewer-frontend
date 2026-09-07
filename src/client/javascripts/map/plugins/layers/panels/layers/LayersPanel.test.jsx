// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/preact'
import { LayersPanel } from './LayersPanel.jsx'

const DATASETS = [
  { id: 'woodland', label: 'Ancient Woodland' },
  { id: 'flood', label: 'Flood Zones' },
  { id: 'peat', label: 'Peaty Soils' }
]

let view
let announce
let dispatch

function renderPanel (state = {}) {
  const pluginState = {
    layers: state.layers ?? [],
    query: state.query ?? '',
    dispatch
  }

  view = render(
    <LayersPanel
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

  test('requests a checked dataset', () => {
    renderPanel()
    const input = view.container.querySelector('#layer-woodland')

    input.checked = true
    input.dispatchEvent(new window.Event('change', { bubbles: true }))

    expect(dispatch).toHaveBeenCalledWith({
      type: 'DATASET_LOADING',
      payload: { id: 'woodland' }
    })
  })

  test('removes an unchecked dataset', () => {
    renderPanel({ layers: [{ id: 'woodland', ready: true }] })
    const input = view.container.querySelector('#layer-woodland')

    input.checked = false
    input.dispatchEvent(new window.Event('change', { bubbles: true }))

    expect(dispatch).toHaveBeenCalledWith({
      type: 'REMOVE_LAYER',
      payload: { id: 'woodland' }
    })
  })

  test('a loading dataset keeps its requested state and is marked busy', () => {
    renderPanel({
      layers: [{ id: 'woodland', ready: false }]
    })

    const input = view.container.querySelector('#layer-woodland')
    expect(input.checked).toBe(true)
    expect(input.disabled).toBe(true)
    expect(input.closest('.govuk-checkboxes__item').getAttribute('aria-busy')).toBe('true')
  })

  test('land summaries delegate enabled state and remain mutually exclusive', () => {
    renderPanel({ layers: [{ id: 'grid', ready: true }] })

    expect(view.container.querySelector('#summary-grid').disabled).toBe(false)
    expect(view.container.querySelector('#summary-features').disabled).toBe(true)

    const input = view.container.querySelector('#summary-grid')
    input.checked = false
    input.dispatchEvent(new window.Event('change', { bubbles: true }))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_SUMMARY',
      payload: { id: 'grid', enabled: false }
    })
  })

  test('keeps hidden datasets checked and visually mutes their label', () => {
    renderPanel({
      layers: [{ id: 'woodland', ready: true, hidden: true }]
    })

    const input = view.container.querySelector('#layer-woodland')
    expect(input.checked).toBe(true)
    expect(input.getAttribute('aria-label')).toBe('Ancient Woodland, hidden')
    expect(input.nextElementSibling.querySelector('.app-map__layers-label--hidden').textContent).toBe('Ancient Woodland')
  })

  test('visually mutes the active land summary when hidden', () => {
    renderPanel({
      layers: [{ id: 'grid', ready: true, hidden: true }]
    })

    const input = view.container.querySelector('#summary-grid')
    const label = view.container.querySelector('label[for="summary-grid"]')

    expect(input.checked).toBe(true)
    expect(input.getAttribute('aria-label')).toBe('Grid squares, hidden')
    expect(label.querySelector('.app-map__layers-label--hidden').textContent).toBe('Grid squares')
  })
})
