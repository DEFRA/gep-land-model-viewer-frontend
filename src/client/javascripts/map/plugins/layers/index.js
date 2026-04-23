import { EVENTS } from '@defra/interactive-map'
import Point from '@arcgis/core/geometry/Point.js'
import WMSLayer from '@arcgis/core/layers/WMSLayer.js'
import { datasets } from '../../config/datasets.js'
import { renderLayersPanelHtml, LAYERS_ICON_SVG } from './render.js'

const BUTTON_ID = 'gep-layers'
const PANEL_ID = 'gep-layers'
const INFO_BUTTON_ID = 'gep-layer-info-toggle'
const INFO_PANEL_ID = 'gep-layer-info'
const INFO_CONTENT_ID = 'gep-layer-info-content'

// Lucide "scan-eye"
const IDENTIFY_ICON_SVG = '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="1"/><path d="M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0"/>'

export function registerLayersPanel (interactiveMap, arcgisMap, view) {
  registerLayerListPanel(interactiveMap, arcgisMap)
  registerIdentifyPanel(interactiveMap, arcgisMap, view)
}

function registerLayerListPanel (interactiveMap, arcgisMap) {
  interactiveMap.addButton(BUTTON_ID, {
    id: BUTTON_ID,
    label: 'Layers',
    panelId: PANEL_ID,
    iconSvgContent: LAYERS_ICON_SVG,
    mobile: { slot: 'top-left', showLabel: false },
    tablet: { slot: 'top-left', showLabel: true },
    desktop: { slot: 'top-left', showLabel: true }
  })

  interactiveMap.addPanel(PANEL_ID, {
    id: PANEL_ID,
    label: 'Layers',
    html: renderLayersPanelHtml(datasets),
    mobile: { slot: 'drawer', open: false, modal: true, dismissible: true, showLabel: false },
    tablet: { slot: 'side', open: false, modal: false, width: '320px', dismissible: true, showLabel: false },
    desktop: { slot: 'side', open: false, modal: false, width: '320px', dismissible: true, showLabel: false }
  })

  interactiveMap.on(EVENTS.APP_PANEL_OPENED, ({ panelId }) => {
    if (panelId === PANEL_ID) {
      interactiveMap.toggleButtonState(BUTTON_ID, 'hidden', true)
    }
  })

  interactiveMap.on(EVENTS.APP_PANEL_CLOSED, ({ panelId }) => {
    if (panelId === PANEL_ID) {
      interactiveMap.toggleButtonState(BUTTON_ID, 'hidden', false)
    }
  })

  document.addEventListener('change', (event) => {
    const input = event.target.closest('[data-app-layer-id]')
    if (!input) {
      return
    }
    const dataset = datasets.find(d => d.id === input.dataset.appLayerId)
    if (!dataset) {
      return
    }
    toggleLayer(dataset, input.checked, arcgisMap)
  })

  document.addEventListener('input', (event) => {
    const search = event.target.closest('[data-app-layer-search]')
    if (search) {
      filterLayers(search.value)
    }
  })
}

function registerIdentifyPanel (interactiveMap, arcgisMap, view) {
  let infoEnabled = false
  const mapContainer = document.getElementById('land-map')

  interactiveMap.addButton(INFO_BUTTON_ID, {
    id: INFO_BUTTON_ID,
    label: 'Identify',
    iconSvgContent: IDENTIFY_ICON_SVG,
    isPressed: false,
    onClick: () => {
      infoEnabled = !infoEnabled
      interactiveMap.toggleButtonState(INFO_BUTTON_ID, 'pressed', infoEnabled)
      mapContainer?.classList.toggle('app-map--identify', infoEnabled)
      if (!infoEnabled) {
        interactiveMap.hidePanel(INFO_PANEL_ID)
      }
    },
    mobile: { slot: 'right-top', showLabel: false, order: 12 },
    tablet: { slot: 'right-top', showLabel: false, order: 12 },
    desktop: { slot: 'right-top', showLabel: false, order: 12 }
  })

  interactiveMap.addPanel(INFO_PANEL_ID, {
    id: INFO_PANEL_ID,
    label: 'Data Layer Attributes',
    html: `<div id="${INFO_CONTENT_ID}"></div>`,
    mobile: { slot: 'drawer', open: false, modal: true, dismissible: true },
    tablet: { slot: 'right-top', open: false, modal: true, width: '500px', dismissible: true },
    desktop: { slot: 'right-top', open: false, modal: true, width: '500px', dismissible: true }
  })

  let infoClickTimeout = null
  interactiveMap.on(EVENTS.MAP_CLICK, ({ coords }) => {
    if (!infoEnabled) {
      return
    }
    if (infoClickTimeout) {
      clearTimeout(infoClickTimeout)
      infoClickTimeout = null
      return
    }
    infoClickTimeout = setTimeout(() => {
      infoClickTimeout = null
      showFeatureInfo(coords, arcgisMap, view, interactiveMap)
    }, 250)
  })
}

async function showFeatureInfo (coords, arcgisMap, view, interactiveMap) {
  const visibleLayers = arcgisMap.layers
    .filter(layer => layer.visible && layer.sublayers)
    .toArray()

  const mapPoint = { x: coords[0], y: coords[1] }
  const results = await Promise.all(
    visibleLayers.map(layer => describeLayerFeatures(layer, mapPoint, view))
  )
  const layersWithFeatures = results.filter(r => r.features.length > 0)
  if (layersWithFeatures.length === 0) {
    return
  }

  const contentEl = document.getElementById(INFO_CONTENT_ID)
  if (contentEl) {
    contentEl.replaceChildren(buildFeatureInfoFragment(layersWithFeatures))
  }
  interactiveMap.showPanel(INFO_PANEL_ID, { focus: false })
}

async function describeLayerFeatures (layer, mapPoint, view) {
  const features = await fetchFeatureInfo(layer, mapPoint, view)
  const dataset = datasets.find(d => layer.id === `gep-${d.id}`)
  return { layerName: dataset?.label ?? layer.title ?? 'Unknown Layer', features }
}

async function fetchFeatureInfo (layer, mapPoint, view) {
  try {
    await layer.load()

    const sublayerNames = layer.sublayers
      ?.filter(s => s.visible)
      .map(s => s.name)
      .toArray()
      .join(',')

    if (!sublayerNames) {
      return []
    }

    const screen = view.toScreen(new Point({
      x: mapPoint.x,
      y: mapPoint.y,
      spatialReference: view.spatialReference
    }))
    const { extent, width, height } = view

    const params = new URLSearchParams({
      SERVICE: 'WMS',
      VERSION: layer.version || '1.3.0',
      REQUEST: 'GetFeatureInfo',
      LAYERS: sublayerNames,
      QUERY_LAYERS: sublayerNames,
      INFO_FORMAT: 'application/json',
      CRS: 'EPSG:27700',
      BBOX: `${extent.xmin},${extent.ymin},${extent.xmax},${extent.ymax}`,
      WIDTH: String(width),
      HEIGHT: String(height),
      I: String(Math.round(screen.x)),
      J: String(Math.round(screen.y))
    })

    const response = await fetch(`${layer.url}?${params}`)
    const data = await response.json()
    return data.features ?? []
  } catch (err) {
    console.error('GetFeatureInfo error:', err)
    return []
  }
}

// WMS GetFeatureInfo properties come from external responses, so build DOM
// nodes with textContent rather than interpolating into an HTML string.
function buildFeatureInfoFragment (layersWithFeatures) {
  const fragment = document.createDocumentFragment()
  layersWithFeatures.forEach(({ layerName, features }, layerIndex) => {
    if (layerIndex > 0) {
      fragment.appendChild(createHr('govuk-section-break govuk-section-break--m govuk-section-break--visible'))
    }

    const heading = document.createElement('h3')
    heading.className = 'govuk-heading-s govuk-!-margin-bottom-2'
    heading.textContent = layerName
    fragment.appendChild(heading)

    features.forEach((feature, featureIndex) => {
      if (featureIndex > 0) {
        fragment.appendChild(createHr('govuk-section-break govuk-section-break--s'))
      }
      fragment.appendChild(buildFeatureSummaryList(feature))
    })
  })
  return fragment
}

function buildFeatureSummaryList (feature) {
  const dl = document.createElement('dl')
  dl.className = 'govuk-summary-list govuk-summary-list--no-border'
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

function createHr (className) {
  const hr = document.createElement('hr')
  hr.className = className
  return hr
}

function toggleLayer (dataset, visible, arcgisMap) {
  const layerId = `gep-${dataset.id}`
  const existing = arcgisMap.findLayerById(layerId)
  if (!visible) {
    if (existing) {
      arcgisMap.remove(existing)
    }
    return
  }
  if (existing) {
    existing.visible = true
    return
  }
  const layerConfig = {
    id: layerId,
    url: dataset.source.url,
    opacity: dataset.source.opacity ?? 1,
    copyright: dataset.source.attribution
  }
  if (dataset.source.layers?.length) {
    layerConfig.sublayers = dataset.source.layers.map(name => ({ name }))
  }
  arcgisMap.add(new WMSLayer(layerConfig))
}

function filterLayers (query) {
  const term = query.trim().toLowerCase()
  const items = document.querySelectorAll('[data-app-layer-item]')
  let visibleCount = 0
  items.forEach(item => {
    const match = !term || item.dataset.label.includes(term)
    item.hidden = !match
    if (match) {
      visibleCount++
    }
  })
  const emptyEl = document.querySelector('[data-app-layer-empty]')
  if (emptyEl) {
    emptyEl.hidden = visibleCount > 0
  }
}
