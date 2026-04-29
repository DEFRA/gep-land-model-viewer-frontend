// @vitest-environment jsdom
import { describe, test, expect } from 'vitest'
import { renderViewModePanelHtml } from './render.js'

describe('#renderViewModePanelHtml', () => {
  test('renders accessible view mode options', () => {
    const html = renderViewModePanelHtml('map')
    const container = document.createElement('div')
    container.innerHTML = html

    const options = container.querySelectorAll('[data-app-view-mode]')
    expect(options).toHaveLength(3)
    expect(Array.from(options).map(o => o.dataset.appViewMode)).toEqual(['map', 'grid', 'feature'])

    const feature = container.querySelector('[data-app-view-mode="feature"]')
    expect(feature.getAttribute('aria-disabled')).toBe('true')
    expect(feature.getAttribute('tabindex')).toBe('-1')

    const list = container.querySelector('ul')
    expect(list.getAttribute('role')).toBe('group')
    expect(list.getAttribute('aria-label')).toBe('Map view mode')
  })

  test('marks the active mode as pressed', () => {
    const html = renderViewModePanelHtml('grid')
    const container = document.createElement('div')
    container.innerHTML = html

    expect(container.querySelector('[data-app-view-mode="grid"]').getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('[data-app-view-mode="map"]').getAttribute('aria-pressed')).toBe('false')
  })
})
