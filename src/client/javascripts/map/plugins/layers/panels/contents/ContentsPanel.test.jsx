// @vitest-environment jsdom
import './test-helpers/browser-mocks.js'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { waitFor } from '@testing-library/dom'
import { fireEvent, render } from '@testing-library/preact'
import { ContentsPanelContent } from './ContentsPanelContent.jsx'
import { useReducer } from 'react'
import { actions, initialState } from '../../reducer.js'
import { KeyPanel } from '../key/KeyPanel.jsx'
import sssiStyle from '../../../../../../data/styles/sssi.json'
import { blurInput } from './test-helpers/preact.js'

const STYLED_DATASET = {
  id: 'styled',
  label: 'Styled layer',
  source: {
    type: 'fgb',
    opacity: 0.7,
    styleConfig: {
      type: 'match',
      classes: [
        { label: 'Woodland', fill: [0, 112, 60, 1] },
        { label: 'Hidden class', fill: [0, 0, 0, 0] },
        { label: 'Grassland', fill: [0, 112, 60, 1] }
      ],
      default: { label: 'Other', fill: [255, 255, 255, 1] }
    }
  }
}

const SSSI_DATASET = { id: 'sssi', label: 'SSSI', source: { type: 'fgb', opacity: 0.5, styleConfig: sssiStyle } }

const DATASETS = [{
  id: 'woodland',
  label: 'Ancient Woodland',
  source: { type: 'wms', opacity: 0.5 }
}, {
  id: 'flood',
  label: 'Flood Zones',
  source: { type: 'wms', opacity: 0.5 }
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
    appState: { breakpoint: 'desktop' },
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

  test('opens opacity-only editing for WMS datasets', () => {
    const view = openEditor(DATASETS[0])
    expect(view.getByRole('slider', { name: 'Opacity' })).toBeTruthy()
    expect(view.queryByRole('button', { name: /^Edit colour for/ })).toBeNull()
  })

  test('summary menus disable Edit layer', () => {
    const view = renderPanel()
    fireEvent.click(view.getByRole('button', { name: 'Layer actions for Grid squares' }))

    expect(view.getByRole('menuitem', { name: 'Edit layer' }).getAttribute('aria-disabled')).toBe('true')
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

function StatefulContents ({ dataset = STYLED_DATASET, open = true, breakpoint = 'desktop' }) {
  const [state, reduce] = useReducer((state, action) => {
    dispatch(action)
    return actions[action.type](state, action.payload)
  }, { ...initialState, layers: [{ id: dataset.id, ready: true }] })
  const props = {
    pluginConfig: { datasets: [dataset], styleNonce: 'test-style-nonce' },
    pluginState: { ...state, dispatch: reduce },
    appState: { breakpoint },
    services: { announce }
  }
  return (
    <>
      {open && <ContentsPanelContent {...props} />}
      <KeyPanel {...props} />
    </>
  )
}

function openEditor (dataset = STYLED_DATASET, breakpoint = 'desktop') {
  const view = render(<StatefulContents dataset={dataset} breakpoint={breakpoint} />)
  fireEvent.click(view.getByRole('button', { name: `Layer actions for ${dataset.label}` }))
  fireEvent.click(view.getByRole('menuitem', { name: 'Edit layer' }))
  return view
}

describe('layer editing integration', () => {
  test('retains colour edits when navigating between mobile editor views', () => {
    const view = openEditor(STYLED_DATASET, 'mobile')
    const swatch = view.getByRole('button', { name: 'Edit colour for Grassland' })
    fireEvent.click(swatch)
    expect([...document.head.querySelectorAll('style')]
      .some(style => style.nonce === 'test-style-nonce' && style.textContent.includes('react-colorful'))).toBe(true)
    const back = view.getByRole('button', { name: 'Back to Edit layer' })
    const hex = view.getByRole('textbox', { name: 'Hex colour' })
    fireEvent.input(hex, { target: { value: '#ff00aa' } })
    blurInput(hex)
    fireEvent.click(back)

    expect(view.getByRole('textbox', { name: 'Opacity percentage' }).value).toBe('70')
    fireEvent.click(view.getByRole('button', { name: 'Edit colour for Woodland' }))
    expect(view.getByRole('textbox', { name: 'Hex colour' }).value).toBe('#00703c')
    fireEvent.click(view.getByRole('button', { name: 'Back to Edit layer' }))
    fireEvent.click(swatch)
    expect(view.getByRole('textbox', { name: 'Hex colour' }).value).toBe('#ff00aa')
  })

  test('commits shorthand hex on Enter, updates Key, and clears restored defaults', () => {
    const view = openEditor()
    fireEvent.click(view.getByRole('button', { name: 'Edit colour for Grassland' }))
    const hex = view.getByRole('textbox', { name: 'Hex colour' })
    fireEvent.input(hex, { target: { value: 'F0A' } })
    expect(hex.value).toBe('F0A')
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_LAYER_COLOUR' }))
    fireEvent.keyDown(hex, { key: 'Enter' })
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'SET_LAYER_COLOUR', payload: { id: 'styled', classIndex: 2, part: 'fill', colour: [255, 0, 170, 1] } })
    expect(hex.value).toBe('#ff00aa')
    const keyRows = view.container.querySelectorAll('.app-map__key-style-row')
    expect(keyRows[1].querySelector('span').style.backgroundColor).toBe('rgb(255, 0, 170)')
    fireEvent.input(hex, { target: { value: '#00703c' } })
    blurInput(hex)
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'SET_LAYER_COLOUR', payload: { id: 'styled', classIndex: 2, part: 'fill', colour: undefined } })
  })

  test('retains committed settings after leaving or closing the editor', async () => {
    const view = openEditor()
    const percentage = view.getByRole('textbox', { name: 'Opacity percentage' })
    fireEvent.input(percentage, { target: { value: '25' } })
    blurInput(percentage)
    fireEvent.click(view.getByRole('button', { name: 'Back to Contents' }))
    await waitFor(() => expect(document.activeElement).toBe(view.getByRole('button', { name: 'Layer actions for Styled layer' })))
    fireEvent.click(view.getByRole('button', { name: 'Layer actions for Styled layer' }))
    fireEvent.click(view.getByRole('menuitem', { name: 'Edit layer' }))
    expect(view.getByRole('slider', { name: 'Opacity' }).value).toBe('25')

    view.rerender(<StatefulContents open={false} />)
    view.rerender(<StatefulContents />)
    fireEvent.click(view.getByRole('button', { name: 'Layer actions for Styled layer' }))
    fireEvent.click(view.getByRole('menuitem', { name: 'Edit layer' }))
    expect(view.getByRole('slider', { name: 'Opacity' }).value).toBe('25')
  })

  test('an outline edit updates Key and Contents together', () => {
    const view = openEditor(SSSI_DATASET)
    fireEvent.click(view.getByRole('button', { name: 'Edit colour for Site of Special Scientific Interest' }))
    fireEvent.click(view.getByRole('radio', { name: 'Outline' }))
    const outlineHex = view.getByRole('textbox', { name: 'Outline hex colour' })
    fireEvent.input(outlineHex, { target: { value: '#000000' } })
    fireEvent.keyDown(outlineHex, { key: 'Enter' })
    const swatches = view.container.querySelectorAll('.app-map__key-style-row .app-map__style-swatch, .app-map__contents-swatch')
    expect(swatches).toHaveLength(2)
    for (const swatch of swatches) {
      expect(swatch.style.backgroundColor).toBe('rgb(178, 102, 204)')
      expect(swatch.style.borderColor).toBe('rgb(0, 0, 0)')
    }
  })
})
