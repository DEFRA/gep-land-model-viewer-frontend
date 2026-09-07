// @vitest-environment jsdom
import { describe, expect, test } from 'vitest'
import { render } from '@testing-library/preact'
import { LayerSwatch } from './LayerSwatch.jsx'

describe('LayerSwatch', () => {
  test('uses the fill and outline for a single-colour style', () => {
    const swatch = {
      type: 'style',
      definition: {
        fill: [10, 20, 30, 0.5],
        stroke: { color: [40, 50, 60, 1], width: 1.25 }
      }
    }
    const view = render(<LayerSwatch swatch={swatch} />)
    const element = view.container.firstElementChild

    expect(element.style.backgroundColor).toBe('rgba(10, 20, 30, 0.5)')
    expect(element.style.borderColor).toBe('rgb(40, 50, 60)')
    expect(element.style.borderWidth).toBe('2px')
  })

  test('renders every style colour in a near-square grid', () => {
    const swatch = {
      type: 'colours',
      colours: [
        [10, 20, 30, 1],
        [40, 50, 60, 1],
        [70, 80, 90, 1],
        [100, 110, 120, 1],
        [130, 140, 150, 1]
      ]
    }
    const view = render(<LayerSwatch swatch={swatch} />)
    const element = view.container.firstElementChild

    expect([...element.querySelectorAll('.app-map__contents-swatch-cell')]
      .map(cell => cell.style.backgroundColor)).toEqual([
      'rgb(10, 20, 30)',
      'rgb(40, 50, 60)',
      'rgb(70, 80, 90)',
      'rgb(100, 110, 120)',
      'rgb(130, 140, 150)'
    ])
    expect(element.style.getPropertyValue('--app-map-contents-swatch-columns')).toBe('3')
    expect(element.style.getPropertyValue('--app-map-contents-swatch-rows')).toBe('2')
    expect(element.getAttribute('aria-hidden')).toBe('true')
  })
})
