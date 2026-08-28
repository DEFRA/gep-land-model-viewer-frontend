// @vitest-environment jsdom
import { describe, test, expect, vi } from 'vitest'
import { render } from '@testing-library/preact'
import { LinkButton } from './LinkButton.jsx'

describe('LinkButton', () => {
  test('renders a button with type="button" and the link class', () => {
    const { container } = render(<LinkButton>Click me</LinkButton>)
    const button = container.querySelector('button')

    expect(button.type).toBe('button')
    expect(button.className).toBe('app-link-button')
    expect(button.textContent).toBe('Click me')
  })

  test('appends extra class names', () => {
    const { container } = render(<LinkButton className='app-map__info-back'>Back</LinkButton>)
    const button = container.querySelector('button')

    expect(button.className).toBe('app-link-button app-map__info-back')
  })

  test('passes through additional props', () => {
    const onClick = vi.fn()
    const { container } = render(<LinkButton onClick={onClick} aria-label='Go back'>Back</LinkButton>)
    const button = container.querySelector('button')

    button.click()

    expect(onClick).toHaveBeenCalledOnce()
    expect(button.getAttribute('aria-label')).toBe('Go back')
  })
})
