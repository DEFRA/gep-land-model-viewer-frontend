// @vitest-environment jsdom
import { vi, describe, test, expect } from 'vitest'

vi.mock('govuk-frontend', () => ({
  createAll: vi.fn(),
  Button: 'Button',
  Checkboxes: 'Checkboxes',
  ErrorSummary: 'ErrorSummary',
  Radios: 'Radios',
  SkipLink: 'SkipLink'
}))

vi.mock('./cookie-consent.js', () => ({
  initCookieBanner: vi.fn(),
  initCookiesPage: vi.fn()
}))

describe('application entry point', () => {
  test('initialises GOV.UK components and cookie consent', async () => {
    const { createAll } = await import('govuk-frontend')
    const { initCookieBanner, initCookiesPage } = await import('./cookie-consent.js')

    await import('./application.js')

    expect(createAll).toHaveBeenCalledTimes(5)
    expect(initCookieBanner).toHaveBeenCalled()
    expect(initCookiesPage).toHaveBeenCalled()
  })
})
