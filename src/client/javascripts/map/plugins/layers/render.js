// Lucide "layers"
export const LAYERS_ICON_SVG = '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>'

// Lucide "scan-eye"
export const IDENTIFY_ICON_SVG = '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="1"/><path d="M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0"/>'

// Lucide "list"
export const KEY_ICON_SVG = '<path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/>'

// Lucide "search"
const SEARCH_ICON_SVG = '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.34-4.34"/>'

const BODY_NO_MARGIN = 'govuk-body govuk-!-margin-bottom-0'

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
        <form class="app-map__layer-search-row" role="search" aria-label="Search layers" data-app-layer-search-form>
          <input
            class="govuk-input app-map__layer-search-input"
            id="layers-search"
            type="search"
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
          ${datasets.map(renderCheckbox).join('')}
        </div>
      </fieldset>
    </div>
  `
}

export function renderKeyPanelHtml (contentId) {
  return `<div id="${contentId}" class="app-map__key-panel"><p class="${BODY_NO_MARGIN}">Enable data layers to view the key.</p></div>`
}

export function renderFeatureInfoPanelHtml (statusId, contentId) {
  return `<div id="${statusId}" class="govuk-visually-hidden" role="status" aria-live="polite" aria-atomic="true"></div><div id="${contentId}" class="app-map__layer-info-panel"></div>`
}

export function buildStatusFragment (message) {
  const fragment = document.createDocumentFragment()
  const container = document.createElement('div')
  container.className = 'app-map__layer-info app-map__layer-info-status'

  const paragraph = document.createElement('p')
  paragraph.className = BODY_NO_MARGIN
  paragraph.textContent = message

  container.appendChild(paragraph)
  fragment.appendChild(container)
  return fragment
}

export function buildFeatureInfoFragment (layerResults) {
  const fragment = document.createDocumentFragment()
  const container = document.createElement('div')
  container.className = 'app-map__layer-info'

  layerResults.forEach(({ layerName, features, error }) => {
    if (error) {
      container.appendChild(buildFeatureErrorSection(layerName))
      return
    }

    features.forEach((feature) => {
      const section = document.createElement('section')
      section.className = 'app-map__layer-info-section'

      const heading = document.createElement('h3')
      heading.className = 'app-map__layer-info-heading govuk-heading-s'
      heading.textContent = layerName

      section.appendChild(heading)
      section.appendChild(buildFeatureSummaryList(feature))
      container.appendChild(section)
    })
  })

  fragment.appendChild(container)
  return fragment
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

function buildFeatureErrorSection (layerName) {
  const section = document.createElement('section')
  section.className = 'app-map__layer-info-section'

  const heading = document.createElement('h3')
  heading.className = 'app-map__layer-info-heading govuk-heading-s'
  heading.textContent = layerName

  const message = document.createElement('p')
  message.className = BODY_NO_MARGIN
  message.textContent = 'Data layer attributes could not be loaded.'

  section.appendChild(heading)
  section.appendChild(message)
  return section
}

function buildFeatureSummaryList (feature) {
  const dl = document.createElement('dl')
  dl.className = 'govuk-summary-list govuk-summary-list--no-border app-map__layer-info-list'
  const props = feature.properties ?? {}
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === '') {
      continue
    }
    const row = document.createElement('div')
    row.className = 'govuk-summary-list__row'

    const dt = document.createElement('dt')
    dt.className = 'govuk-summary-list__key'
    dt.textContent = key

    const dd = document.createElement('dd')
    dd.className = 'govuk-summary-list__value'
    dd.textContent = value

    row.appendChild(dt)
    row.appendChild(dd)
    dl.appendChild(row)
  }
  return dl
}
