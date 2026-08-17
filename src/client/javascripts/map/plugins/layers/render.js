import escapeHtml from 'lodash/escape.js'
import { renderRowHtml } from '../info-panel/render.js'

// Lucide "layers"
export const LAYERS_ICON_SVG = '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>'

// Lucide "list"
export const KEY_ICON_SVG = '<path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/>'

// Lucide "search"
const SEARCH_ICON_SVG = '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.34-4.34"/>'

const BODY_NO_MARGIN = 'govuk-body govuk-!-margin-bottom-0'

export const SUMMARY_TOGGLES = [
  { id: 'grid', label: 'Grid squares' },
  { id: 'features', label: 'OS features' }
]

function renderSummaryCheckbox (toggle) {
  return `
    <div class="govuk-checkboxes__item">
      <input
        class="govuk-checkboxes__input"
        id="summary-${toggle.id}"
        type="checkbox"
        data-app-summary-id="${toggle.id}"
      >
      <label class="govuk-label govuk-checkboxes__label" for="summary-${toggle.id}">
        ${toggle.label}
      </label>
    </div>
  `
}

function renderLandSummarySection () {
  return `
    <div class="app-map__land-summary">
      <h3 class="govuk-heading-s govuk-!-margin-bottom-2">Land summary</h3>
      <p class="govuk-body">Inspect any point on the map to see its land cover, use, ownership, protected areas and soils.</p>
      <fieldset class="govuk-fieldset govuk-!-margin-top-2">
        <legend class="govuk-body govuk-!-font-weight-bold govuk-!-margin-bottom-2">Summarise land by:</legend>
        <div class="govuk-checkboxes govuk-checkboxes--small">
          ${SUMMARY_TOGGLES.map(renderSummaryCheckbox).join('')}
        </div>
      </fieldset>
    </div>
  `
}

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
  const sortedDatasets = [...datasets].sort((a, b) => a.label.localeCompare(b.label))
  return `
    <div class="app-map__layers-content">
      <h2 class="app-map__layers-header">
        <svg class="app-map__layers-header-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">${LAYERS_ICON_SVG}</svg>
        Layers
      </h2>
      <div class="app-map__layers-scroll">
        ${renderLandSummarySection()}
        <h3 class="govuk-heading-s govuk-!-margin-bottom-2">Datasets</h3>
        <p class="govuk-body govuk-!-margin-bottom-4">Add datasets to the map.</p>
        <div class="govuk-form-group app-map__layer-search">
          <label class="govuk-label" for="layers-search">Search</label>
          <form class="app-map__layer-search-row" role="search" aria-label="Search layers" data-app-layer-search-form>
            <input
              class="govuk-input app-map__layer-search-input"
              id="layers-search"
              type="search"
              placeholder="Find datasets"
              autocomplete="off"
              aria-controls="layers-list"
              data-app-layer-search
            >
            <button
              class="govuk-button app-map__layer-search-button"
              type="submit"
              aria-label="Search layers"
              data-module="govuk-button"
            >
              <svg class="app-map__layer-search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" focusable="false" aria-hidden="true">${SEARCH_ICON_SVG}</svg>
            </button>
          </form>
        </div>
        <div data-app-layer-empty class="govuk-body govuk-hint" role="status" hidden>No layers match your search.</div>
        <fieldset class="govuk-fieldset">
          <legend class="govuk-visually-hidden">Data layers</legend>
          <div class="govuk-checkboxes govuk-checkboxes--small" id="layers-list" data-app-layer-list>
            ${sortedDatasets.map(renderCheckbox).join('')}
          </div>
        </fieldset>
      </div>
    </div>
  `
}

export function renderKeyPanelHtml (contentId) {
  return `<div id="${contentId}" class="app-map__key-panel"><p class="${BODY_NO_MARGIN}">Enable data layers to view the key.</p></div>`
}

/**
 * Renders a dataset hit's attributes for the info panel: one summary list per
 * feature found at the click.
 * @param {string} label Dataset label
 * @param {Array<object>} featureProperties Property objects, one per feature
 * @returns {string}
 */
export function renderDatasetAttributesHtml (label, featureProperties) {
  const lists = featureProperties.map(properties => {
    const rows = Object.entries(properties)
      .filter(([, value]) => value != null && value !== '')
      .map(([key, value]) => renderRowHtml(key, value))
      .join('')
    return `<dl class="govuk-summary-list app-map__info-attributes">${rows}</dl>`
  }).join('')

  return `
    <div class="app-map__info-content">
      <h3 class="govuk-heading-s">${escapeHtml(label)}</h3>
      ${lists || '<p class="govuk-body">No attributes found at this location.</p>'}
    </div>
  `
}

export function buildKeyFragment (entries) {
  const fragment = document.createDocumentFragment()

  if (!entries.length) {
    const empty = document.createElement('p')
    empty.className = BODY_NO_MARGIN
    empty.textContent = 'Enable data layers to view the key.'
    fragment.appendChild(empty)
    return fragment
  }
  const grid = document.createElement('div')
  grid.className = 'app-map__key-grid'

  entries.forEach(({ label, layerNames, baseUrl }) => {
    const entry = document.createElement('div')
    entry.className = 'app-map__key-entry'

    const heading = document.createElement('h3')
    heading.className = 'govuk-heading-xs govuk-!-margin-bottom-1'
    heading.textContent = label
    entry.appendChild(heading)

    const legends = document.createElement('div')
    legends.className = 'app-map__key-legends'

    layerNames.forEach(name => {
      const row = document.createElement('div')
      row.className = 'app-map__key-legend-row'

      const img = document.createElement('img')
      img.className = 'app-map__key-legend'
      img.src = `${baseUrl}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&LAYER=${encodeURIComponent(name)}&FORMAT=image/png`
      img.alt = `Legend for ${name.replaceAll('_', ' ')}`
      img.crossOrigin = 'anonymous'

      const layerLabel = document.createElement('span')
      layerLabel.className = 'govuk-body-s govuk-!-margin-bottom-0'
      layerLabel.textContent = name.replaceAll('_', ' ')

      row.appendChild(layerLabel)
      row.appendChild(img)
      legends.appendChild(row)
    })

    entry.appendChild(legends)
    grid.appendChild(entry)
  })

  fragment.appendChild(grid)
  return fragment
}
