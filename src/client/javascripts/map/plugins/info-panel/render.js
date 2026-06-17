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

/**
 * @param {string} title
 * @param {object} [options]
 * @param {string} [options.previewHtml]
 * @param {string} [options.detailHtml]
 * @param {boolean} [options.open]
 * @returns {string}
 */
export function renderSectionHtml (title, { previewHtml = '', detailHtml = '', open = false } = {}) {
  const preview = previewHtml ? `<span class="app-map__info-section-value">${previewHtml}</span>` : ''
  return `
    <details class="app-map__info-section"${open ? ' open' : ''}>
      <summary class="app-map__info-section-heading">
        <span class="app-map__info-section-title">${escapeHtml(title)}</span>
        ${preview}
      </summary>
      <div class="app-map__info-section-detail">${detailHtml}</div>
    </details>
  `
}

/**
 * @param {Array<{ label: string, percentage: number }>} breakdown
 * @returns {string}
 */
export function renderProportionHtml (breakdown) {
  if (!breakdown.length) {
    return ''
  }

  const minOpacity = 0.35
  const opacityRange = 1 - minOpacity
  const max = breakdown[0].percentage
  const items = breakdown
    .map((entry) => {
      const pct = `${entry.percentage}%`
      const opacity = max > 0 ? minOpacity + opacityRange * (entry.percentage / max) : 1
      const label = `${escapeHtml(entry.label)}: ${escapeHtml(pct)}`
      return `
      <li class="app-map__cover-item">
        <span class="app-map__cover-label">${escapeHtml(entry.label)}</span>
        <span class="app-map__cover-track">
          <span class="app-map__cover-bar" role="img" aria-label="${label}" data-app-percent="${Number(entry.percentage)}" data-app-opacity="${opacity.toFixed(2)}"></span>
        </span>
        <span class="app-map__cover-percent">${escapeHtml(pct)}</span>
      </li>
    `
    })
    .join('')

  return `
    <p class="app-map__info-subheading">Proportion of area</p>
    <ul class="app-map__cover-list">${items}</ul>
    <p class="app-map__cover-note">*Percentages may not add up to 100% due to rounding.</p>
  `
}

export function applyBarStyles (container) {
  for (const bar of container.querySelectorAll('.app-map__cover-bar[data-app-percent]')) {
    bar.style.width = `${bar.dataset.appPercent}%`
    bar.style.opacity = bar.dataset.appOpacity
  }
}

export function renderPanelShellHtml () {
  return `<div id="${INFO_PANEL_CONTENT_ID}" class="app-map__info-panel"></div>`
}
