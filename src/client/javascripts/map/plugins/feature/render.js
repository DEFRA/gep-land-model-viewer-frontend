import { format } from 'date-fns'
import escapeHtml from 'lodash/escape.js'
import { renderRowHtml, renderMessageHtml, renderSectionHtml, renderProportionHtml } from '../info-panel/render.js'

const EMPTY = '-'

export function renderEmptyStateHtml () {
  return renderMessageHtml('Select a land parcel on the map to view its details.')
}

/**
 * @param {{ osid?: string }} hit
 * @param {import('./data.js').Parcel | null} parcel
 * @returns {string}
 */
export function renderFeatureInfoHtml (hit, parcel) {
  if (!parcel) {
    return renderUnavailableHtml(hit)
  }

  return `
    <div class="app-map__info-content">
      ${renderIds(parcel)}
      ${renderLandCoverSection(parcel.landCover)}
      ${renderLandUseSection(parcel.landUse)}
      ${renderTopographySection(parcel)}
      ${renderSoilSection(parcel.soil)}
    </div>
  `
}

function renderUnavailableHtml (hit) {
  return `
    <div class="app-map__info-content">
      <dl class="govuk-summary-list govuk-summary-list--no-border app-map__feature-ids">
        ${renderRowHtml('OSID', hit?.osid ?? EMPTY)}
      </dl>
      ${renderMessageHtml('Attribute details are unavailable for this parcel.')}
    </div>
  `
}

function renderIds (parcel) {
  return `
    <dl class="govuk-summary-list govuk-summary-list--no-border app-map__feature-ids">
      ${renderRowHtml('OSID', parcel.osid)}
      ${renderRowHtml('TOID', parcel.toid)}
    </dl>
  `
}

function renderLandCoverSection (landCover) {
  const summary = landCover.isMixed ? 'Mixed' : (landCover.dominantLabel ?? EMPTY)
  const detail = `
    ${renderProportionHtml(landCover.breakdown)}
    <dl class="govuk-summary-list govuk-summary-list--no-border app-map__info-list">
      ${renderRowHtml('Data source', landCover.source ?? EMPTY)}
      ${renderRowHtml('Last updated', formatDate(landCover.date))}
    </dl>
  `
  return renderSectionHtml('Land cover', { previewHtml: escapeHtml(summary), detailHtml: detail })
}

function renderLandUseSection (landUse) {
  const detail = `
    <dl class="govuk-summary-list govuk-summary-list--no-border app-map__info-list">
      ${renderRowHtml('Classification', landUse.label ?? EMPTY)}
      ${renderRowHtml('Code', landUse.code ?? EMPTY)}
    </dl>
  `
  return renderSectionHtml('Land use', { previewHtml: escapeHtml(landUse.label ?? EMPTY), detailHtml: detail })
}

function renderSoilSection (soil) {
  const summary = soil.isMixed ? 'Mixed' : (soil.dominantLabel ?? EMPTY)
  const detail = `
    ${renderProportionHtml(soil.breakdown)}
    <dl class="govuk-summary-list govuk-summary-list--no-border app-map__info-list">
      ${renderRowHtml('Data source', soil.source ?? EMPTY)}
      ${renderRowHtml('Last updated', formatDate(soil.date))}
    </dl>
  `
  return renderSectionHtml('Soils', { previewHtml: escapeHtml(summary), detailHtml: detail })
}

function renderTopographySection (parcel) {
  const { topography, elevation, slope, aspect } = parcel
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

function formatMetres (value) {
  if (value == null) {
    return EMPTY
  }
  return `${value}m`
}

function formatDegrees (value) {
  if (value == null) {
    return EMPTY
  }
  return `${value}°`
}

/**
 * @param {Date | null} value
 * @returns {string}
 */
function formatDate (value) {
  if (!value) {
    return EMPTY
  }
  return format(value, 'yyyy-MM-dd')
}

function formatAspectMean (value, label) {
  if (value == null) {
    return EMPTY
  }

  const degrees = `${value}°`
  if (!label) {
    return degrees
  }
  return `${degrees} (${sentenceCase(label)})`
}

function formatSlope (value, aspectLabel) {
  if (value == null) {
    return EMPTY
  }

  const degrees = `${value}°`
  if (!aspectLabel) {
    return degrees
  }
  return `${degrees} (${sentenceCase(aspectLabel)})`
}

function sentenceCase (value) {
  return value.charAt(0) + value.slice(1).toLowerCase()
}
