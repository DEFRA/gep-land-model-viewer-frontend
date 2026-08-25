// @vitest-environment jsdom
import { describe, test, expect } from 'vitest'
import { render } from '@testing-library/preact'
import { InfoLinks } from './InfoLinks.jsx'

describe('InfoLinks', () => {
  test('renders each link, opening in a new tab', () => {
    const { getAllByRole } = render(<InfoLinks />)
    const links = getAllByRole('link')

    expect(links.map(link => link.getAttribute('href'))).toEqual([
      '/accessibility-statement',
      '/cookies',
      '/privacy'
    ])
    expect(links.map(link => link.textContent.trim())).toEqual([
      'Accessibility statement (opens in new tab)',
      'Cookies (opens in new tab)',
      'Privacy (opens in new tab)'
    ])
    expect(links.every(link => link.getAttribute('rel') === 'noopener noreferrer' && link.getAttribute('target') === '_blank')).toBe(true)
  })
})
