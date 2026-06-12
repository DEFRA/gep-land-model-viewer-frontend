// @vitest-environment jsdom
import { describe, test, expect } from 'vitest'
import { renderPanelShellHtml, renderMessageHtml, renderRowHtml } from './render.js'
import { INFO_PANEL_CONTENT_ID } from './constants.js'

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
