import { describe, test, expect } from 'vitest'
import { renderInfoLinksPanelHtml } from './render.js'

describe('#renderInfoLinksPanelHtml', () => {
  test('renders info links html', () => {
    const html = renderInfoLinksPanelHtml()
    expect(html).toContain('/accessibility-statement')
    expect(html).toContain('/cookies')
    expect(html).toContain('/privacy')
  })

  test('links include opens in new tab text', () => {
    const html = renderInfoLinksPanelHtml()
    const matches = html.match(/opens in new tab/g)
    expect(matches).toHaveLength(3)
  })

  test('links include target blank and noopener', () => {
    const html = renderInfoLinksPanelHtml()
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })
})
