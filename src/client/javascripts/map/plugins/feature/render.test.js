// @vitest-environment jsdom
import { describe, test, expect } from 'vitest'
import { renderEmptyStateHtml, renderFeatureInfoHtml } from './render.js'

describe('#renderEmptyStateHtml', () => {
  test('renders guidance to select a land parcel', () => {
    const container = document.createElement('div')
    container.innerHTML = renderEmptyStateHtml()
    const message = container.querySelector('.app-map__info-panel-message')

    expect(message).not.toBeNull()
    expect(message.textContent).toBe('Select a land parcel on the map to view its details.')
  })
})

describe('#renderFeatureInfoHtml', () => {
  test('renders osid and description', () => {
    const html = renderFeatureInfoHtml({
      osid: 'abc-123',
      description: 'Arable Land'
    })
    const container = document.createElement('div')
    container.innerHTML = html

    expect(container.textContent).toContain('abc-123')
    expect(container.textContent).toContain('Arable Land')
  })

  test('escapes HTML in osid and description', () => {
    const html = renderFeatureInfoHtml({
      osid: '<img src=x onerror="alert(1)">',
      description: '"><script>alert(2)</script>'
    })
    const container = document.createElement('div')
    container.innerHTML = html

    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })

  test('renders dash for missing description', () => {
    const html = renderFeatureInfoHtml({
      osid: 'abc-123',
      description: undefined
    })
    const container = document.createElement('div')
    container.innerHTML = html

    const values = container.querySelectorAll('.govuk-summary-list__value')
    const descriptionValue = values[1]
    expect(descriptionValue.textContent.trim()).toBe('-')
  })
})
