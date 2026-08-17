import { format, parse, isValid } from 'date-fns'
import escapeHtml from 'lodash/escape.js'
import { INFO_PANEL_CONTENT_ID, INFO_PANEL_STATUS_ID, SAMPLE_LINK_CLASS } from './constants.js'

export const EMPTY = '-'

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

export function renderUnavailableNoticeHtml (label) {
  return `
    <div class="app-map__info-unavailable">
      <p class="govuk-body">This ${escapeHtml(label)} is not covered by the sample land model.</p>
      <a href="#" class="app-link-button ${SAMPLE_LINK_CLASS}">Go to the sample area</a>
    </div>
  `
}

export function renderUnavailableContentHtml (idRowsHtml, typeLabel) {
  return `
    <div class="app-map__info-content">
      <dl class="govuk-summary-list govuk-summary-list--no-border app-map__info-ids">
        ${idRowsHtml}
      </dl>
      ${renderUnavailableNoticeHtml(typeLabel)}
    </div>
  `
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
  return `
    <div id="${INFO_PANEL_STATUS_ID}" class="govuk-visually-hidden" role="status"></div>
    <div id="${INFO_PANEL_CONTENT_ID}" class="app-map__info-panel"></div>
  `
}

// Lucide "chevron-right" / "chevron-left"
const CHEVRON_RIGHT_SVG = '<path d="m9 18 6-6-6-6"/>'
const CHEVRON_LEFT_SVG = '<path d="m15 18-6-6 6-6"/>'

/**
 * @param {Array<{ label: string }>} hits
 * @returns {string}
 */
export function renderHitListHtml (hits) {
  const rows = hits.map((hit, index) => `
    <li class="app-map__info-hit-row">
      <button type="button" class="app-map__info-hit" data-app-hit-index="${index}">
        <span>${escapeHtml(hit.label)}</span>
        <svg class="app-map__info-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">${CHEVRON_RIGHT_SVG}</svg>
      </button>
    </li>
  `).join('')

  return `
    <div class="app-map__info-content">
      <p class="govuk-body app-map__info-hit-hint">More than one feature is at this location. Select one to view its attributes.</p>
      <ul class="app-map__info-hit-list">${rows}</ul>
    </div>
  `
}

/**
 * Wraps a hit's detail view, prefixing a back link when the hit was picked
 * from a multi-hit list.
 * @param {string} bodyHtml
 * @param {number} backCount Size of the list to go back to, 0 for a direct hit.
 * @returns {string}
 */
export function renderHitDetailHtml (bodyHtml, backCount) {
  if (!backCount) {
    return bodyHtml
  }

  return `
    <button type="button" class="app-link-button app-map__info-back" data-app-hit-back>
      <svg class="app-map__info-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">${CHEVRON_LEFT_SVG}</svg>
      Back to ${backCount} selected
    </button>
    ${bodyHtml}
  `
}

export function formatMetres (value) {
  if (value == null) {
    return EMPTY
  }
  return `${value}m`
}

export function formatDegrees (value) {
  if (value == null) {
    return EMPTY
  }
  return `${value}°`
}

export function toDate (value) {
  if (!value) {
    return null
  }

  const date = parse(value, 'dd/MM/yyyy', new Date(0))
  if (!isValid(date)) {
    return null
  }

  return date
}

export function formatDate (value) {
  if (!value) {
    return EMPTY
  }
  return format(value, 'yyyy-MM-dd')
}

export function sentenceCase (value) {
  return value.charAt(0) + value.slice(1).toLowerCase()
}

export function formatSlope (value, aspectLabel) {
  if (value == null) {
    return EMPTY
  }

  const degrees = `${value}°`
  if (!aspectLabel) {
    return degrees
  }
  return `${degrees} (${sentenceCase(aspectLabel)})`
}

export function formatAspectMean (value, label) {
  if (value == null && !label) {
    return EMPTY
  }
  if (value == null) {
    return sentenceCase(label)
  }

  const degrees = `${value}°`
  if (!label) {
    return degrees
  }
  return `${degrees} (${sentenceCase(label)})`
}

function renderTopoRow (label, elevationValue, slopeValue, aspectValue) {
  return `
    <tr class="govuk-table__row">
      <th scope="row" class="govuk-table__header">${escapeHtml(label)}</th>
      <td class="govuk-table__cell">${escapeHtml(String(elevationValue))}</td>
      <td class="govuk-table__cell">${escapeHtml(String(slopeValue))}</td>
      <td class="govuk-table__cell">${escapeHtml(String(aspectValue))}</td>
    </tr>
  `
}

export function renderLandUseHtml (landUse) {
  const detail = `
    <dl class="govuk-summary-list govuk-summary-list--no-border app-map__info-list">
      ${renderRowHtml('Classification', landUse.label ?? EMPTY)}
      ${renderRowHtml('Code', landUse.code ?? EMPTY)}
    </dl>
  `
  return renderSectionHtml('Land use', { previewHtml: escapeHtml(landUse.label ?? EMPTY), detailHtml: detail })
}

export function renderTopographyHtml ({ topography, elevation, slope, aspect }) {
  return '' // Topography disabled for R1

  // eslint-disable-next-line no-unreachable
  const summary = [
    `Elevation: ${escapeHtml(formatMetres(elevation.mean))}`,
    `Slope: ${escapeHtml(formatSlope(slope.mode, aspect.label))}`
  ].join(' &nbsp; ')

  const detail = `
    <div class="app-map__topo-details">
      <table class="govuk-table app-map__topo-table">
        <thead>
          <tr>
            <td class="app-map__topo-corner"></td>
            <th scope="col" class="govuk-table__header">Elevation</th>
            <th scope="col" class="govuk-table__header">Slope</th>
            <th scope="col" class="govuk-table__header">Aspect</th>
          </tr>
        </thead>
        <tbody>
          ${renderTopoRow('Minimum', formatMetres(elevation.min), formatDegrees(slope.min), EMPTY)}
          ${renderTopoRow('Maximum', formatMetres(elevation.max), formatDegrees(slope.max), EMPTY)}
          ${renderTopoRow('Mean', formatMetres(elevation.mean), formatDegrees(slope.mean), formatAspectMean(aspect.mean, aspect.label))}
          ${renderTopoRow('Mode', formatMetres(elevation.mode), formatDegrees(slope.mode), EMPTY)}
        </tbody>
      </table>
    </div>
    <dl class="govuk-summary-list govuk-summary-list--no-border app-map__info-list">
      ${renderRowHtml('Data source', topography.source ?? EMPTY)}
      ${renderRowHtml('Last updated', formatDate(topography.date))}
    </dl>
  `
  return renderSectionHtml('Topography', { previewHtml: summary, detailHtml: detail })
}
