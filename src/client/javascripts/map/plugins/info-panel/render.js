import escapeHtml from 'lodash/escape.js'
import { INFO_PANEL_CONTENT_ID } from './constants.js'

export function renderRowHtml (key, value) {
  return `
    <div class="govuk-summary-list__row">
      <dt class="govuk-summary-list__key">${escapeHtml(key)}</dt>
      <dd class="govuk-summary-list__value">${escapeHtml(value)}</dd>
    </div>
  `
}

export function renderMessageHtml (text) {
  return `<p class="govuk-body govuk-hint app-map__info-panel-message">${escapeHtml(text)}</p>`
}

export function renderPanelShellHtml () {
  return `<div id="${INFO_PANEL_CONTENT_ID}" class="app-map__info-panel"></div>`
}
