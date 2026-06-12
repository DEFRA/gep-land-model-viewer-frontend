import { renderRowHtml, renderMessageHtml } from '../info-panel/render.js'

function detailSection (title, rows) {
  return `
    <details class="app-map__grid-info-section" open>
      <summary class="app-map__grid-info-section-heading">${title}</summary>
      <dl class="govuk-summary-list govuk-summary-list--no-border app-map__grid-info-list">
        ${rows.map(([key, value]) => renderRowHtml(key, value)).join('')}
      </dl>
    </details>
  `
}

function valueSection (title, value) {
  return `
    <details class="app-map__grid-info-section" open>
      <summary class="app-map__grid-info-section-heading">${title}</summary>
      <p class="govuk-body app-map__grid-info-section-value">${value}</p>
    </details>
  `
}

export function renderEmptyStateHtml () {
  return renderMessageHtml('Select a grid cell on the map to view its details.')
}

export function renderCellInfoHtml ({ cellId, easting, northing }) {
  return `
    <div class="app-map__info-content">
      <dl class="govuk-summary-list govuk-summary-list--no-border app-map__info-summary">
        ${renderRowHtml('Easting', easting)}
        ${renderRowHtml('Northing', northing)}
      </dl>
      <p class="govuk-body app-map__grid-info-reference">Grid square: ${cellId}</p>

      ${valueSection('Land use', 'Agriculture')}
      ${detailSection('Topography', [['Elevation', '85m'], ['Slope', '2 degrees (flat)']])}
    </div>
  `
}
