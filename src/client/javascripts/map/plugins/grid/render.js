import { renderRowHtml, renderMessageHtml, renderSectionHtml } from '../info-panel/render.js'

function detailSection (title, rows) {
  const detailHtml = `
    <dl class="govuk-summary-list govuk-summary-list--no-border app-map__info-list">
      ${rows.map(([key, value]) => renderRowHtml(key, value)).join('')}
    </dl>
  `
  return renderSectionHtml(title, { detailHtml, open: true })
}

function valueSection (title, value) {
  return renderSectionHtml(title, { detailHtml: `<p class="govuk-body app-map__info-value">${value}</p>`, open: true })
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
