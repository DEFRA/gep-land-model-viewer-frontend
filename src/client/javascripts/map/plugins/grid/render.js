function row (key, value) {
  return `
    <div class="govuk-summary-list__row">
      <dt class="govuk-summary-list__key">${key}</dt>
      <dd class="govuk-summary-list__value">${value}</dd>
    </div>
  `
}

export function renderInitialInfoPanelHtml (contentId) {
  return `
    <div id="${contentId}">
      <p class="govuk-body govuk-hint">
        Click a grid cell on the map to view its details.
      </p>
    </div>
  `
}

export function renderCellInfoHtml ({ cellId, easting, northing }) {
  return `
    <dl class="govuk-summary-list govuk-summary-list--no-border app-map__cell-info">
      ${row('Cell ID', cellId)}
      ${row('Easting', `${easting} m`)}
      ${row('Northing', `${northing} m`)}
      ${row('Cell size', '10 m × 10 m')}
    </dl>
  `
}
