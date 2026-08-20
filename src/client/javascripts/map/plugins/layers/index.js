import { EVENTS } from '@defra/interactive-map'
import { datasets } from '../../config/datasets.js'
import { mapStyles } from '../../config/map-styles.js'
import { datasetForLayer, layerIdFor, overviewIdFor } from '../../config/layers.js'
import { UNKNOWN_LAYER_LABEL } from './constants.js'
import { createCogLayer } from './cog-layer.js'
import { createFlatGeobufLayers } from './fgb-layer.js'
import { createWmsLayer, getSourceUrl, getVisibleWmsLayers } from './wms-layer.js'
import { registerZoomWarning } from './zoom-warning.js'
import {
  buildKeyFragment,
  renderKeyPanelHtml,
  renderLayersPanelHtml,
  SUMMARY_TOGGLES,
  KEY_ICON_SVG,
  LAYERS_ICON_SVG
} from './render.js'

const BUTTON_ID = 'gep-layers'
const PANEL_ID = 'gep-layers'
const KEY_BUTTON_ID = 'gep-key'
const KEY_PANEL_ID = 'gep-key'
const KEY_CONTENT_ID = 'gep-key-content'

let listeners = null

export function registerLayersPanel (interactiveMap, map, initialStyleId, infoPanel, summaryControllers = {}) {
  listeners?.abort()
  listeners = new AbortController()

  registerLayerListPanel(interactiveMap, map, initialStyleId, infoPanel, summaryControllers)
}

function setBaseAttribution (mapStyleId) {
  baseAttribution = mapStyles.find(s => s.id === mapStyleId)?.attribution ?? mapStyles[0].attribution
}

// Only one land summary can be shown at a time.
function setOtherSummaryTogglesDisabled (activeId, disabled) {
  for (const toggle of SUMMARY_TOGGLES) {
    if (toggle.id !== activeId) {
      const input = document.querySelector(`[data-app-summary-id="${toggle.id}"]`)
      if (input) {
        input.disabled = disabled
      }
    }
  }
}

function registerLayerListPanel (interactiveMap, map, initialStyleId, infoPanel, summaryControllers) {
  const zoomWarning = registerZoomWarning(map)
  setBaseAttribution(initialStyleId)
  const refreshAttributions = () => refreshAttributionsForVisibleLayers(map)
  refreshAttributions()
  interactiveMap.on(EVENTS.MAP_STYLE_CHANGE, ({ mapStyleId }) => {
    setBaseAttribution(mapStyleId)
    refreshAttributions()
  })

  registerLayersButton(interactiveMap)
  registerKeyPanel(interactiveMap)

  document.addEventListener('change', (event) => {
    const summaryInput = event.target.closest('[data-app-summary-id]')
    if (summaryInput) {
      toggleSummary(summaryInput, summaryControllers, zoomWarning)
      return
    }

    const input = event.target.closest('[data-app-layer-id]')
    if (input) {
      toggleDataset(input, map, { zoomWarning, infoPanel, refreshAttributions })
    }
  }, { signal: listeners.signal })

  registerLayerSearch(listeners.signal)
}

function registerLayersButton (interactiveMap) {
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
}

function toggleSummary (summaryInput, summaryControllers, zoomWarning) {
  const summaryId = summaryInput.dataset.appSummaryId
  const controller = summaryControllers[summaryId]
  if (!controller) {
    return
  }

  controller.setVisible(summaryInput.checked)
  setOtherSummaryTogglesDisabled(summaryId, summaryInput.checked)
  zoomWarning.set(`summary-${summaryId}`, {
    label: SUMMARY_TOGGLES.find(toggle => toggle.id === summaryId).label,
    minZoom: controller.minZoom,
    enabled: summaryInput.checked
  })
}

function toggleDataset (input, map, { zoomWarning, infoPanel, refreshAttributions }) {
  const dataset = datasets.find(d => d.id === input.dataset.appLayerId)
  if (!dataset) {
    return
  }

  const visible = input.checked
  setLayerInputLoading(input, true)
  toggleLayer(dataset, visible, map).catch((err) => {
    console.error(`Failed to load data layer ${dataset.id}`, err)
  }).finally(() => {
    // Keep UI state in sync with the map even when a layer update fails.
    const layerId = layerIdFor(dataset)
    const shown = visible && Boolean(findLayerById(map, layerId))
    if (visible && !shown) {
      input.checked = false
    }
    const floor = shown ? datasetZoomFloor(map, layerId) : undefined
    zoomWarning.set(dataset.id, {
      label: dataset.label,
      minZoom: floor,
      enabled: floor !== undefined
    })
    refreshKey(map)
    refreshAttributions()
    infoPanel?.refreshHits()
    setLayerInputLoading(input, false)
  })
}

function registerLayerSearch (signal) {
  document.addEventListener('submit', (event) => {
    if (!event.target.matches('[data-app-layer-search-form]')) {
      return
    }
    event.preventDefault()
    filterLayers(event.target.querySelector('[data-app-layer-search]')?.value ?? '')
  }, { signal })

  document.addEventListener('search', (event) => {
    const search = event.target.closest('[data-app-layer-search]')
    if (search) {
      filterLayers(search.value)
    }
  }, { signal })
}

function registerKeyPanel (interactiveMap) {
  interactiveMap.addButton(KEY_BUTTON_ID, {
    id: KEY_BUTTON_ID,
    label: 'Key',
    panelId: KEY_PANEL_ID,
    iconSvgContent: KEY_ICON_SVG,
    mobile: { slot: 'top-left', showLabel: false },
    tablet: { slot: 'top-left', showLabel: true },
    desktop: { slot: 'top-left', showLabel: true }
  })

  interactiveMap.addPanel(KEY_PANEL_ID, {
    id: KEY_PANEL_ID,
    label: 'Key',
    html: renderKeyPanelHtml(KEY_CONTENT_ID),
    mobile: { slot: 'drawer', open: false, modal: true, dismissible: true },
    tablet: { slot: 'left-top', open: false, modal: false, width: '450px', dismissible: true },
    desktop: { slot: 'left-top', open: false, modal: false, width: '450px', dismissible: true }
  })
}

function findLayerById (map, id) {
  return map.getLayers().getArray().find(l => l.get('id') === id)
}

// An overview removes the zoom floor; otherwise use the detail layer's first
// rendered zoom.
function datasetZoomFloor (map, layerId) {
  if (findLayerById(map, overviewIdFor(layerId))) {
    return undefined
  }

  const layer = findLayerById(map, layerId)
  const minZoom = layer.getMinZoom()
  if (minZoom !== -Infinity) {
    // OL's minZoom is exclusive, the first drawn zoom is the one above it.
    return minZoom + 1
  }

  return undefined
}

function findDatasetLayers (map, layerId) {
  return map.getLayers().getArray()
    .filter(l => l.get('id') === layerId || l.get('id') === overviewIdFor(layerId))
}

function setLayerInputLoading (input, loading) {
  input.disabled = loading
  const item = input.closest('[data-app-layer-item]')
  if (!item) {
    return
  }

  if (!loading) {
    item.removeAttribute('aria-busy')
    return
  }

  item.setAttribute('aria-busy', 'true')
}

async function toggleLayer (dataset, visible, map) {
  const layerId = layerIdFor(dataset)
  const existing = findDatasetLayers(map, layerId)
  if (existing.length > 0) {
    existing.forEach(layer => layer.setVisible(visible))
    return
  }

  if (!visible) {
    return
  }

  const layers = await createDatasetLayers(dataset, layerId, map)
  layers.forEach(layer => map.addLayer(layer))
}

async function createDatasetLayers (dataset, layerId, map) {
  const { type } = dataset.source
  if (type === 'cog') {
    return [await createCogLayer(dataset, layerId)]
  } else if (type === 'fgb') {
    return createFlatGeobufLayers(dataset, layerId, map)
  } else if (type === 'wms') {
    const layer = await createWmsLayer(dataset, layerId)
    return layer ? [layer] : []
  } else {
    return []
  }
}

function refreshKey (map) {
  const contentEl = document.getElementById(KEY_CONTENT_ID)
  if (!contentEl) {
    return
  }

  const entries = getVisibleWmsLayers(map).map(layer => {
    const dataset = datasetForLayer(layer, datasets)
    const label = dataset?.label ?? UNKNOWN_LAYER_LABEL
    const source = layer.getSource()
    const layerNames = source.getParams().LAYERS
    const baseUrl = getSourceUrl(source)
    if (!layerNames || !baseUrl) {
      return null
    }
    return { label, baseUrl, layerNames: layerNames.split(',') }
  }).filter(Boolean)

  contentEl.replaceChildren(buildKeyFragment(entries))
}

let baseAttribution

function getCurrentAttribution (map) {
  const visibleAttributions = getVisibleWmsLayers(map)
    .map(layer => datasetForLayer(layer, datasets)?.source.attribution)
    .filter(Boolean)

  return [...new Set([baseAttribution, ...visibleAttributions])].join(' | ')
}

function refreshAttributionsForVisibleLayers (map) {
  const attribution = getCurrentAttribution(map)
  const attributionEl = document.querySelector('.im-c-attributions')
  if (attributionEl) {
    attributionEl.textContent = attribution
  }
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
