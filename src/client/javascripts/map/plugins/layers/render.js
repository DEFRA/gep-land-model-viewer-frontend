// Lucide "layers"
export const LAYERS_ICON_SVG = '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>'

// Lucide "search"
const SEARCH_ICON_SVG = '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.34-4.34"/>'

function renderCheckbox (dataset) {
  const checked = dataset.defaultVisible ? ' checked' : ''
  return `
    <div class="govuk-checkboxes__item" data-app-layer-item data-label="${dataset.label.toLowerCase()}">
      <input
        class="govuk-checkboxes__input"
        id="layer-${dataset.id}"
        type="checkbox"
        data-app-layer-id="${dataset.id}"${checked}
      >
      <label class="govuk-label govuk-checkboxes__label" for="layer-${dataset.id}">
        ${dataset.label}
      </label>
    </div>
  `
}

export function renderLayersPanelHtml (datasets) {
  return `
    <div class="app-map__layers-content">
      <h2 class="app-map__layers-header">
        <svg class="app-map__layers-header-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">${LAYERS_ICON_SVG}</svg>
        Layers
      </h2>
      <h3 class="govuk-heading-s govuk-!-margin-bottom-2">Select data layers</h3>
      <p class="govuk-body-s govuk-!-margin-bottom-4">Select datasets from the GEP repository to visualise on the map viewer</p>
      <div class="govuk-form-group app-map__layer-search">
        <label class="govuk-label" for="layers-search">Search</label>
        <div class="app-map__layer-search-row">
          <input
            class="govuk-input app-map__layer-search-input"
            id="layers-search"
            type="search"
            autocomplete="off"
            data-app-layer-search
          >
          <button
            class="govuk-button app-map__layer-search-button"
            type="button"
            aria-label="Search layers"
            data-module="govuk-button"
          >
            <svg class="app-map__layer-search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" focusable="false" aria-hidden="true">${SEARCH_ICON_SVG}</svg>
          </button>
        </div>
      </div>
      <div data-app-layer-empty class="govuk-body govuk-hint" hidden>No layers match your search.</div>
      <div class="govuk-checkboxes govuk-checkboxes--small" data-app-layer-list>
        ${datasets.map(renderCheckbox).join('')}
      </div>
    </div>
  `
}
