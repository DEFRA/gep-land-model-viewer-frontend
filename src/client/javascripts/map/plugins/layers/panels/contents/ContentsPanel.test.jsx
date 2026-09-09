// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { waitFor } from '@testing-library/dom'
import { fireEvent, render } from '@testing-library/preact'
import { ContentsPanelContent } from './ContentsPanelContent.jsx'

// jsdom lacks the browser APIs used by dnd-kit and Base UI.
// dnd-kit reads ResizeObserver while its modules are loading.
vi.hoisted(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe () {}
    unobserve () {}
    disconnect () {}
  }
  globalThis.IntersectionObserver = class IntersectionObserver {
    observe () {}
    unobserve () {}
    disconnect () {}
    takeRecords () { return [] }
  }
  Document.prototype.getAnimations = () => []
  Element.prototype.getAnimations = () => []
  Element.prototype.animate = () => ({ finished: Promise.resolve() })
  window.matchMedia = query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener () {},
    removeListener () {},
    addEventListener () {},
    removeEventListener () {},
    dispatchEvent () { return false }
  })
})

const DATASETS = [{
  id: 'woodland',
  label: 'Ancient Woodland',
  source: { type: 'wms' }
}, {
  id: 'flood',
  label: 'Flood Zones',
  source: { type: 'wms' }
}]

let announce
let dispatch

function contentsState (overrides = {}) {
  return {
    layers: [
      { id: 'grid', ready: true },
      { id: 'flood', ready: true },
      { id: 'woodland', ready: true, hidden: true }
    ],
    ...overrides,
    dispatch
  }
}

function panelProps (pluginState = contentsState()) {
  return {
    pluginConfig: { datasets: DATASETS, styleNonce: 'test-style-nonce' },
    pluginState,
    services: { announce }
  }
}

function renderPanel (pluginState = contentsState()) {
  return render(<ContentsPanelContent {...panelProps(pluginState)} />)
}

function prepareKeyboardDrag (view) {
  const rows = view.getAllByRole('listitem')
  rows.forEach((row, index) => {
    const bounds = () => ({
      x: 0,
      y: index * 50,
      top: index * 50,
      right: 300,
      bottom: index * 50 + 50,
      left: 0,
      width: 300,
      height: 50
    })
    row.getBoundingClientRect = bounds
    row.querySelector('.app-map__contents-reorder').getBoundingClientRect = bounds
  })

  let ancestor = rows[0].parentElement
  while (ancestor && ancestor !== document.documentElement) {
    ancestor.style.overflow = 'visible'
    ancestor.style.overflowX = 'visible'
    ancestor.style.overflowY = 'visible'
    ancestor = ancestor.parentElement
  }

  return {
    rows,
    reorderButton: view.getByRole('button', { name: 'Reorder Ancient Woodland' })
  }
}

beforeEach(() => {
  announce = vi.fn()
  dispatch = vi.fn()
})

describe('ContentsPanel', () => {
  test('shows the empty state when no layers are added', () => {
    const view = renderPanel(contentsState({
      layers: []
    }))

    expect(view.getByText('No layers added')).toBeTruthy()
    expect(view.queryByRole('list')).toBeNull()
  })

  test('lists summaries and datasets in top-most-first order', () => {
    const view = renderPanel()
    const rows = view.getAllByRole('listitem')

    expect(rows.map(row => row.querySelector('.app-map__contents-label').textContent)).toEqual([
      'Grid squares',
      'Flood Zones',
      'Ancient Woodland'
    ])
    expect(view.getByRole('button', { name: 'Show Ancient Woodland' })).toBeTruthy()
    expect(view.getByRole('button', { name: 'Hide Grid squares' })).toBeTruthy()
    expect(view.getAllByRole('button', { name: /^Reorder / })).toHaveLength(3)
    expect(rows[2].classList.contains('app-map__contents-row--hidden')).toBe(true)
  })

  test('dispatches and announces visibility changes', () => {
    const view = renderPanel()

    fireEvent.click(view.getByRole('button', { name: 'Show Ancient Woodland' }))
    fireEvent.click(view.getByRole('button', { name: 'Hide Flood Zones' }))

    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: 'SET_LAYER_HIDDEN',
      payload: { id: 'woodland', hidden: false }
    })
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: 'SET_LAYER_HIDDEN',
      payload: { id: 'flood', hidden: true }
    })
    expect(announce.mock.calls).toEqual([['Ancient Woodland shown'], ['Flood Zones hidden']])
  })

  test('dispatches and announces removal', () => {
    const view = renderPanel()

    fireEvent.click(view.getByRole('button', { name: 'Remove Flood Zones' }))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'REMOVE_LAYER',
      payload: { id: 'flood' }
    })
    expect(announce).toHaveBeenCalledWith('Flood Zones removed')
  })

  test('moves through the actions menu fallback', () => {
    const view = renderPanel()
    const actionsButton = view.getByRole('button', { name: 'Layer actions for Ancient Woodland' })

    fireEvent.click(actionsButton)
    fireEvent.click(view.getByRole('menuitem', { name: 'Move to top' }))

    expect(dispatch).toHaveBeenCalledWith({
      type: 'MOVE_LAYER',
      payload: { id: 'woodland', position: 'top' }
    })
    expect(announce).toHaveBeenCalledWith('Ancient Woodland moved to position 1 of 3')
  })

  test('offers disabled editing for datasets', () => {
    const view = renderPanel()
    fireEvent.click(view.getByRole('button', { name: 'Layer actions for Ancient Woodland' }))

    expect(view.getByRole('menuitem', { name: 'Edit layer' }).getAttribute('aria-disabled')).toBe('true')
  })

  test('summary menus omit Edit layer', () => {
    const view = renderPanel()
    fireEvent.click(view.getByRole('button', { name: 'Layer actions for Grid squares' }))

    expect(view.queryByRole('menuitem', { name: 'Edit layer' })).toBeNull()
  })

  test('supports full-row keyboard dragging and commits the resulting order', async () => {
    const view = renderPanel()
    const { rows, reorderButton } = prepareKeyboardDrag(view)
    const announcement = await view.findByRole('status')

    fireEvent.keyDown(reorderButton, { key: ' ', code: 'Space' })
    await waitFor(() => expect(rows[2].classList.contains('app-map__contents-row--dragging')).toBe(true))
    await waitFor(() => expect(announcement.textContent).toBe('Ancient Woodland picked up.'))
    expect([...document.head.querySelectorAll('style')]
      .some(style => style.nonce === 'test-style-nonce')).toBe(true)
    fireEvent.keyDown(reorderButton, { key: 'ArrowUp', code: 'ArrowUp' })
    await waitFor(() => expect(announcement.textContent).toBe('Ancient Woodland moved to position 2.'))
    fireEvent.keyDown(reorderButton, { key: ' ', code: 'Space' })

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_LAYER_ORDER',
      payload: { order: ['grid', 'woodland', 'flood'] }
    }))
    await waitFor(() => expect(announcement.textContent).toBe('Ancient Woodland placed at position 2.'))
  })

  test('cancels full-row keyboard dragging without committing the order', async () => {
    const view = renderPanel()
    const { rows, reorderButton } = prepareKeyboardDrag(view)
    const announcement = await view.findByRole('status')

    fireEvent.keyDown(reorderButton, { key: ' ', code: 'Space' })
    await waitFor(() => expect(rows[2].classList.contains('app-map__contents-row--dragging')).toBe(true))
    fireEvent.keyDown(reorderButton, { key: 'ArrowUp', code: 'ArrowUp' })
    await Promise.resolve()
    fireEvent.keyDown(reorderButton, { key: 'Escape', code: 'Escape' })
    await waitFor(() => expect(rows[2].classList.contains('app-map__contents-row--dragging')).toBe(false))

    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_LAYER_ORDER' }))
    await waitFor(() => expect(announcement.textContent).toBe('Reordering Ancient Woodland cancelled.'))
  })

  test('disables all row actions while a dataset is loading', () => {
    const view = renderPanel(contentsState({
      layers: [{ id: 'flood', ready: false }]
    }))
    const reorderButton = view.getByRole('button', { name: 'Reorder Flood Zones' })
    const row = reorderButton.closest('li')

    expect(row.getAttribute('aria-busy')).toBe('true')
    expect([...row.querySelectorAll('button')].every(button => button.disabled)).toBe(true)
  })
})
