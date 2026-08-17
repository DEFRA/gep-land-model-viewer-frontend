import escapeHtml from 'lodash/escape.js'
import { EMPTY, renderRowHtml, renderSectionHtml, renderProportionHtml, renderUnavailableContentHtml, formatDate, renderLandUseHtml, renderTopographyHtml } from '../info-panel/render.js'

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
      ${renderLandUseHtml(parcel.landUse)}
      ${renderTopographyHtml(parcel)}
      ${renderSoilSection(parcel.soil)}
    </div>
  `
}

function renderUnavailableHtml (hit) {
  return renderUnavailableContentHtml(renderRowHtml('OSID', hit?.osid ?? EMPTY), 'parcel')
}

function renderIds (parcel) {
  return `
    <dl class="govuk-summary-list govuk-summary-list--no-border app-map__info-ids">
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
