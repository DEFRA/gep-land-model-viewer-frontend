import { renderRowHtml, renderMessageHtml } from '../info-panel/render.js'

export function renderEmptyStateHtml () {
  return renderMessageHtml('Select a land parcel on the map to view its details.')
}

export function renderFeatureInfoHtml (feature) {
  return `
    <div class="app-map__info-content">
      <dl class="govuk-summary-list govuk-summary-list--no-border app-map__info-summary">
        ${renderRowHtml('OSID', feature.osid)}
        ${renderRowHtml('Description', feature.description ?? '-')}
      </dl>
    </div>
  `
}
