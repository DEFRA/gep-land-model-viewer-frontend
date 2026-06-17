// @vitest-environment jsdom
import { describe, test, expect } from 'vitest'
import { renderPanelShellHtml, renderMessageHtml, renderRowHtml, renderSectionHtml, renderProportionHtml, applyBarStyles } from './render.js'
import { INFO_PANEL_CONTENT_ID } from './constants.js'

function render (html) {
  const container = document.createElement('div')
  container.innerHTML = html
  return container
}

describe('#renderPanelShellHtml', () => {
  test('renders the content container with the shared content id', () => {
    const container = document.createElement('div')
    container.innerHTML = renderPanelShellHtml()
    const shell = container.querySelector(`#${INFO_PANEL_CONTENT_ID}`)

    expect(shell).not.toBeNull()
    expect(shell.classList.contains('app-map__info-panel')).toBe(true)
  })
})

describe('#renderMessageHtml', () => {
  test('renders hint text with the message class', () => {
    const container = document.createElement('div')
    container.innerHTML = renderMessageHtml('Loading details')
    const message = container.querySelector('.app-map__info-panel-message')

    expect(message).not.toBeNull()
    expect(message.textContent).toBe('Loading details')
  })
})

describe('#renderRowHtml', () => {
  test('escapes HTML in the key and value', () => {
    const container = document.createElement('div')
    container.innerHTML = `<dl>${renderRowHtml('<b>Key</b>', '<img src=x onerror="alert(1)">')}</dl>`

    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(container.textContent).toContain('<b>Key</b>')
  })
})

describe('#renderSectionHtml', () => {
  test('renders a collapsed disclosure with an escaped title', () => {
    const section = render(renderSectionHtml('Land cover', { detailHtml: '<p>body</p>' }))
      .querySelector('.app-map__info-section')

    expect(section.open).toBe(false)
    expect(section.querySelector('.app-map__info-section-title').textContent).toBe('Land cover')
    expect(section.querySelector('.app-map__info-section-detail').textContent.trim()).toBe('body')
  })

  test('shows the preview value when collapsed and omits it when no preview is given', () => {
    expect(render(renderSectionHtml('Land cover', { previewHtml: 'Mixed' }))
      .querySelector('.app-map__info-section-value').textContent).toBe('Mixed')
    expect(render(renderSectionHtml('Topography'))
      .querySelector('.app-map__info-section-value')).toBeNull()
  })

  test('renders expanded when open is set', () => {
    expect(render(renderSectionHtml('Land use', { open: true }))
      .querySelector('.app-map__info-section').open).toBe(true)
  })

  test('does not escape pre-built preview and detail markup', () => {
    const section = render(renderSectionHtml('Topography', { previewHtml: 'Elevation: 85m', detailHtml: '<table></table>' }))

    expect(section.querySelector('table')).not.toBeNull()
  })
})

describe('#renderProportionHtml', () => {
  test('renders a bar and percentage per breakdown entry', () => {
    const container = render(renderProportionHtml([
      { label: 'Improved grass', percentage: 82.2 },
      { label: 'Woodland', percentage: 17.8 }
    ]))
    const bars = container.querySelectorAll('.app-map__cover-bar')

    expect(bars).toHaveLength(2)
    expect(bars[0].dataset.appPercent).toBe('82.2')
    expect(bars[0].getAttribute('aria-label')).toBe('Improved grass: 82.2%')
    expect(container.textContent).toContain('82.2%')
    expect(container.textContent).toContain('Improved grass')
  })

  test('applyBarStyles sets width and opacity from data attributes', () => {
    const container = render(renderProportionHtml([
      { label: 'Cropped land', percentage: 60 },
      { label: 'Woodland', percentage: 10 }
    ]))
    applyBarStyles(container)
    const bars = container.querySelectorAll('.app-map__cover-bar')

    expect(bars[0].style.width).toBe('60%')
    expect(Number(bars[0].style.opacity)).toBe(1)
    expect(bars[1].style.width).toBe('10%')
    expect(Number(bars[1].style.opacity)).toBeLessThan(1)
    expect(Number(bars[1].style.opacity)).toBeGreaterThan(0.3)
  })

  test('renders nothing for an empty breakdown', () => {
    expect(renderProportionHtml([])).toBe('')
  })

  test('uses full opacity when all percentages are zero', () => {
    const container = render(renderProportionHtml([{ label: 'Unknown', percentage: 0 }]))
    const bar = container.querySelector('.app-map__cover-bar')

    expect(bar.dataset.appOpacity).toBe('1.00')
  })

  test('escapes the entry label', () => {
    const container = render(renderProportionHtml([{ label: '<script>alert(1)</script>', percentage: 100 }]))

    expect(container.querySelector('script')).toBeNull()
  })
})
