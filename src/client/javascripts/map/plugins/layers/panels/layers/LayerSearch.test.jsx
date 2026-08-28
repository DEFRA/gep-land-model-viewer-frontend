// @vitest-environment jsdom
import { describe, test, expect, vi } from 'vitest'
import { render } from '@testing-library/preact'
import { LayerSearch } from './LayerSearch.jsx'

describe('LayerSearch', () => {
  test('reflects a committed query change without replacing the input', () => {
    const onSearch = vi.fn()
    const view = render(<LayerSearch query='wood' onSearch={onSearch} />)
    const input = /** @type {HTMLInputElement} */ (view.container.querySelector('input'))

    expect(input.value).toBe('wood')

    view.rerender(<LayerSearch query='flood' onSearch={onSearch} />)

    expect(view.container.querySelector('input')).toBe(input)
    expect(input.value).toBe('flood')
  })
})
