import escapeHtml from 'lodash/escape.js'
import { EMPTY, renderRowHtml, renderMessageHtml, renderSectionHtml, renderUnavailableContentHtml, formatDate, renderLandUseHtml, renderTopographyHtml } from '../info-panel/render.js'

export function renderEmptyStateHtml () {
  return renderMessageHtml('Select a grid cell on the map to view its details.')
}

/**
 * @param {{ cellId: import('./bng-reference.js').BngReference }} hit
 * @param {import('./data.js').GridCell | null} details
 * @returns {string}
 */
export function renderCellInfoHtml (hit, details) {
  if (!details) {
    return renderUnavailableHtml(hit)
  }

  return `
    <div class="app-map__info-content">
      <dl class="govuk-summary-list govuk-summary-list--no-border app-map__info-ids">
        ${renderRowHtml('Grid square', hit.cellId)}
      </dl>

      ${renderLandCoverSection(details.landCover)}
      ${renderLandUseHtml(details.landUse)}
      ${renderTopographyHtml(details)}
      ${renderSoilSection(details.soil)}
    </div>
  `
}

function renderUnavailableHtml (hit) {
  return renderUnavailableContentHtml(renderRowHtml('Grid square', hit.cellId), 'grid cell')
}

function renderLandCoverSection (landCover) {
  const detail = `
    <dl class="govuk-summary-list govuk-summary-list--no-border app-map__info-list">
      ${renderRowHtml('Dominant cover', landCover.label ?? EMPTY)}
      ${renderRowHtml('Code', landCover.code ?? EMPTY)}
      ${renderRowHtml('Data source', landCover.source ?? EMPTY)}
      ${renderRowHtml('Last updated', formatDate(landCover.date))}
    </dl>
  `
  return renderSectionHtml('Land cover', { previewHtml: escapeHtml(landCover.label ?? EMPTY), detailHtml: detail })
}

function renderSoilSection (soil) {
  const detail = `
    <dl class="govuk-summary-list govuk-summary-list--no-border app-map__info-list">
      ${renderRowHtml('Soil type', soil.label ?? EMPTY)}
      ${renderRowHtml('Data source', soil.source ?? EMPTY)}
      ${renderRowHtml('Last updated', formatDate(soil.date))}
    </dl>
  `
  return renderSectionHtml('Soils', { previewHtml: escapeHtml(soil.label ?? EMPTY), detailHtml: detail })
}
