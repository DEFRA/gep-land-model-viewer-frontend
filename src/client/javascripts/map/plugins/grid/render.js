function row (key, value) {
  return `
    <div class="govuk-summary-list__row">
      <dt class="govuk-summary-list__key">${key}</dt>
      <dd class="govuk-summary-list__value">${value}</dd>
    </div>
  `
}

function detailSection (title, rows) {
  return `
    <details class="app-map__grid-info-section" open>
      <summary class="app-map__grid-info-section-heading">${title}</summary>
      <dl class="govuk-summary-list govuk-summary-list--no-border app-map__grid-info-list">
        ${rows.map(([key, value]) => row(key, value)).join('')}
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

export function renderInitialInfoPanelHtml (contentId) {
  return `
    <div id="${contentId}" class="app-map__grid-info-panel">
      <p class="govuk-body govuk-hint app-map__grid-info-empty">
        Click a grid cell on the map to view its details.
      </p>
    </div>
  `
}

export function renderCellInfoHtml ({ cellId, easting, northing }) {
  return `
    <div class="app-map__grid-info">
      <dl class="govuk-summary-list govuk-summary-list--no-border app-map__grid-info-coordinates">
        ${row('Easting', easting)}
        ${row('Northing', northing)}
      </dl>
      <p class="govuk-body app-map__grid-info-reference">Grid square: ${cellId}</p>

      ${valueSection('Land use', 'Agriculture')}
      ${detailSection('Topography', [['Elevation', '85m'], ['Slope', '2 degrees (flat)']])}
    </div>
  `
}
