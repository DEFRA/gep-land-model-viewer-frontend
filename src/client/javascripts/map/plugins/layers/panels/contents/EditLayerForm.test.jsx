// @vitest-environment jsdom
import './test-helpers/browser-mocks.js'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { waitFor } from '@testing-library/dom'
import { fireEvent, render } from '@testing-library/preact'
import { useReducer } from 'react'
import { actions, initialState } from '../../reducer.js'
import { EditLayerForm } from './EditLayerForm.jsx'
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

let dispatch

function StatefulForm ({ dataset }) {
  const [state, reduce] = useReducer((state, action) => {
    dispatch(action)
    return actions[action.type](state, action.payload)
  }, { ...initialState, layers: [{ id: dataset.id, ready: true }] })

  return (
    <EditLayerForm dataset={dataset} layer={state.layers[0]} dispatch={reduce} onBack={vi.fn()} />
  )
}

function renderForm (dataset = STYLED_DATASET) {
  return render(<StatefulForm dataset={dataset} />)
}

beforeEach(() => {
  dispatch = vi.fn()
})

describe('EditLayerForm', () => {
  test('opens drawable colours in Key order and allows the default to be edited', () => {
    const view = renderForm()
    expect(view.getAllByRole('button', { name: /^Edit colour for/ }).map(button => button.getAttribute('aria-label')))
      .toEqual(['Edit colour for Woodland', 'Edit colour for Grassland', 'Edit colour for Other'])
    fireEvent.click(view.getByRole('button', { name: 'Edit colour for Grassland' }))
    expect(view.getByRole('group', { name: 'Fill colour for Grassland' })).toBeTruthy()
    expect(view.getByRole('textbox', { name: 'Hex colour' }).value).toBe('#00703c')
    fireEvent.click(view.getByRole('button', { name: 'Edit colour for Other' }))
    const hex = view.getByRole('textbox', { name: 'Hex colour' })
    expect(hex.value).toBe('#ffffff')
    fireEvent.input(hex, { target: { value: '#123abc' } })
    fireEvent.keyDown(hex, { key: 'Enter' })
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'SET_LAYER_COLOUR', payload: { id: 'styled', classIndex: undefined, part: 'fill', colour: [18, 58, 188, 1] } })
  })

  test('keeps incomplete hex for correction without applying an intermediate colour', () => {
    const view = renderForm()
    fireEvent.click(view.getByRole('button', { name: 'Edit colour for Woodland' }))
    const hex = view.getByRole('textbox', { name: 'Hex colour' })
    fireEvent.input(hex, { target: { value: '#123' } })
    fireEvent.input(hex, { target: { value: '#12345' } })
    blurInput(hex)
    expect(view.getByRole('alert').textContent).toContain('Error: Enter 3 or 6 hexadecimal characters')
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_LAYER_COLOUR' }))
    expect(hex.value).toBe('#12345')
    expect(hex.getAttribute('aria-invalid')).toBe('true')

    fireEvent.input(hex, { target: { value: '#123456' } })
    fireEvent.keyDown(hex, { key: 'Enter' })
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'SET_LAYER_COLOUR', payload: { id: 'styled', classIndex: 0, part: 'fill', colour: [18, 52, 86, 1] } })
    expect(view.queryByRole('alert')).toBeNull()
    expect(hex.getAttribute('aria-invalid')).toBeNull()
  })

  test('replaces invalid hex with a picker preview and commits the colour on completion', async () => {
    const view = renderForm()
    fireEvent.click(view.getByRole('button', { name: 'Edit colour for Woodland' }))
    const hex = view.getByRole('textbox', { name: 'Hex colour' })
    fireEvent.input(hex, { target: { value: '#12345' } })
    blurInput(hex)
    expect(view.getByRole('alert')).toBeTruthy()

    const hue = view.getByRole('slider', { name: 'Hue' })
    fireEvent.keyDown(hue, { key: 'ArrowRight', keyCode: 39 })
    await waitFor(() => expect(view.queryByRole('alert')).toBeNull())
    expect(hex.value).toMatch(/^#[\da-f]{6}$/)
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_LAYER_COLOUR' }))
    fireEvent.keyUp(hue, { key: 'ArrowRight', keyCode: 39 })
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_LAYER_COLOUR' }))
  })

  test('discards invalid hex when the picker is closed', async () => {
    const view = renderForm()
    const swatch = view.getByRole('button', { name: 'Edit colour for Woodland' })
    fireEvent.click(swatch)
    const hex = view.getByRole('textbox', { name: 'Hex colour' })
    fireEvent.input(hex, { target: { value: '#12345' } })
    blurInput(hex)
    fireEvent.click(view.getByRole('button', { name: 'Close colour picker' }))
    await waitFor(() => expect(view.queryByRole('textbox', { name: 'Hex colour' })).toBeNull())

    fireEvent.click(swatch)
    expect(view.getByRole('textbox', { name: 'Hex colour' }).value).toBe('#00703c')
    expect(view.queryByRole('alert')).toBeNull()
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_LAYER_COLOUR' }))
  })

  test('synchronises opacity controls and converts percentages to 0–1 values', () => {
    const view = renderForm()
    const percentage = view.getByRole('textbox', { name: 'Opacity percentage' })
    const slider = view.getByRole('slider', { name: 'Opacity' })
    expect(percentage.value).toBe('70')
    fireEvent.input(percentage, { target: { value: '1' } })
    expect(slider.value).toBe('70')
    expect(slider.getAttribute('aria-valuetext')).toBe('70%')
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_LAYER_OPACITY' }))
    fireEvent.keyDown(percentage, { key: 'Enter' })
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'SET_LAYER_OPACITY', payload: { id: 'styled', opacity: 0.01 } })
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(percentage.value).toBe('2')
    expect(slider.getAttribute('aria-valuetext')).toBe('2%')
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'SET_LAYER_OPACITY', payload: { id: 'styled', opacity: 0.02 } })

    fireEvent.input(percentage, { target: { value: ' 70 ' } })
    blurInput(percentage)
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'SET_LAYER_OPACITY', payload: { id: 'styled', opacity: undefined } })
  })

  test.each(['', '0', '-1', '101', '1.5', 'abc'])('rejects invalid percentage %s', (value) => {
    const view = renderForm()
    const percentage = view.getByRole('textbox', { name: 'Opacity percentage' })
    fireEvent.input(percentage, { target: { value } })
    blurInput(percentage)
    expect(view.getByRole('alert').textContent).toContain('Error: Enter a whole number from 1 to 100')
    expect(view.getByRole('slider', { name: 'Opacity' }).value).toBe('70')
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_LAYER_OPACITY' }))
  })

  test('allows an invalid percentage to be corrected', () => {
    const view = renderForm()
    const percentage = view.getByRole('textbox', { name: 'Opacity percentage' })
    fireEvent.input(percentage, { target: { value: '1.5' } })
    blurInput(percentage)

    fireEvent.input(percentage, { target: { value: '25' } })
    fireEvent.keyDown(percentage, { key: 'Enter' })
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'SET_LAYER_OPACITY', payload: { id: 'styled', opacity: 0.25 } })
    expect(view.getByRole('slider', { name: 'Opacity' }).value).toBe('25')
    expect(view.queryByRole('alert')).toBeNull()
  })

  test('resets fill, outline and opacity together', async () => {
    const view = renderForm(SSSI_DATASET)
    const percentage = view.getByRole('textbox', { name: 'Opacity percentage' })
    fireEvent.input(percentage, { target: { value: '20' } })
    blurInput(percentage)
    const swatch = view.getByRole('button', { name: 'Edit colour for Site of Special Scientific Interest' })
    fireEvent.click(swatch)
    const fillHex = view.getByRole('textbox', { name: 'Fill hex colour' })
    fireEvent.input(fillHex, { target: { value: '#ffffff' } })
    blurInput(fillHex)
    fireEvent.click(view.getByRole('radio', { name: 'Outline' }))
    const outlineHex = view.getByRole('textbox', { name: 'Outline hex colour' })
    fireEvent.input(outlineHex, { target: { value: '#000000' } })
    blurInput(outlineHex)
    fireEvent.click(view.getByRole('button', { name: 'Reset to defaults' }))
    await waitFor(() => expect(view.queryByRole('textbox', { name: 'Outline hex colour' })).toBeNull())
    expect(view.getByRole('textbox', { name: 'Opacity percentage' }).value).toBe('50')
    fireEvent.click(swatch)
    expect(view.getByRole('textbox', { name: 'Fill hex colour' }).value).toBe('#b266cc')
    fireEvent.click(view.getByRole('radio', { name: 'Outline' }))
    expect(view.getByRole('textbox', { name: 'Outline hex colour' }).value).toBe('#703087')
  })

  test('switching parts clears invalid drafts and errors', () => {
    const view = renderForm(SSSI_DATASET)
    const swatch = view.getByRole('button', { name: 'Edit colour for Site of Special Scientific Interest' })
    fireEvent.click(swatch)
    const fillHex = view.getByRole('textbox', { name: 'Fill hex colour' })
    fireEvent.input(fillHex, { target: { value: '#12345' } })
    blurInput(fillHex)
    expect(view.getByRole('alert')).toBeTruthy()
    fireEvent.click(view.getByRole('radio', { name: 'Outline' }))
    expect(view.queryByRole('alert')).toBeNull()
    expect(view.getByRole('textbox', { name: 'Outline hex colour' }).value).toBe('#703087')
    fireEvent.click(view.getByRole('radio', { name: 'Fill' }))
    expect(view.getByRole('textbox', { name: 'Fill hex colour' }).value).toBe('#b266cc')
  })

  test('edits a visible outline when the fill is transparent', () => {
    const dataset = { ...SSSI_DATASET, source: { ...SSSI_DATASET.source, styleConfig: { type: 'uniform', classes: [{ label: 'Boundary', fill: [0, 0, 0, 0], stroke: { color: [112, 48, 135, 0.5], width: 2 } }] } } }
    const view = renderForm(dataset)
    fireEvent.click(view.getByRole('button', { name: 'Edit colour for Boundary' }))
    expect(view.queryByRole('group', { name: 'Colour to edit' })).toBeNull()
    const hex = view.getByRole('textbox', { name: 'Outline hex colour' })
    fireEvent.input(hex, { target: { value: '#fff' } })
    fireEvent.keyDown(hex, { key: 'Enter' })
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'SET_LAYER_COLOUR', payload: { id: 'sssi', classIndex: 0, part: 'stroke', colour: [255, 255, 255, 0.5] } })
    const preview = view.container.querySelector('.app-map__colour-value .app-map__style-swatch')
    expect(preview.style.backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(preview.style.borderColor).toBe('rgba(255, 255, 255, 0.5)')
  })
})
