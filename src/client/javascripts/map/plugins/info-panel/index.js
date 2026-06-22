import { EVENTS } from '@defra/interactive-map'
import { INFO_PANEL_ID, INFO_PANEL_CONTENT_ID, INFO_PANEL_OPEN_CLASS, SAMPLE_CENTER, SAMPLE_LINK_CLASS, SAMPLE_ZOOM } from './constants.js'
import { renderPanelShellHtml, renderMessageHtml, applyBarStyles } from './render.js'

const LOADING_HTML = renderMessageHtml('Loading details...')
const ERROR_HTML = renderMessageHtml('Could not load details. Try selecting again.')
const SECTION_SELECTOR = '.app-map__info-section'
const TITLE_SELECTOR = '.app-map__info-section-title'
const sectionState = new Map()

function saveSectionState (container) {
  for (const s of container.querySelectorAll(SECTION_SELECTOR)) {
    const title = s.querySelector(TITLE_SELECTOR)?.textContent.trim()
    if (title) {
      sectionState.set(title, s.open)
    }
  }
}

function restoreSectionState (container) {
  for (const s of container.querySelectorAll(SECTION_SELECTOR)) {
    const title = s.querySelector(TITLE_SELECTOR)?.textContent.trim()
    if (title && sectionState.has(title)) {
      s.open = sectionState.get(title)
    }
  }
}

function updateContent (innerHtml) {
  const el = document.getElementById(INFO_PANEL_CONTENT_ID)
  if (el) {
    saveSectionState(el)
    el.innerHTML = innerHtml
    applyBarStyles(el)
    restoreSectionState(el)
  }
}

async function showDetails (inspector, hit, signal) {
  try {
    const details = await inspector.loadDetails(hit, { signal })
    if (signal.aborted) {
      return
    }
    updateContent(inspector.renderHtml(hit, details))
  } catch (err) {
    if (signal.aborted) {
      return
    }
    console.error('Failed to load details for selection', err)
    updateContent(ERROR_HTML)
  }
}

function bindSampleLink (mapContainer, map) {
  mapContainer?.addEventListener('click', (e) => {
    const link = e.target.closest(`.${SAMPLE_LINK_CLASS}`)
    if (link) {
      e.preventDefault()
      const view = map.getView()
      view.setCenter(SAMPLE_CENTER)
      view.setZoom(SAMPLE_ZOOM)
    }
  })
}

/**
 * @typedef {object} Inspector
 * @property {string} emptyHtml
 * @property {(coords: number[]) => object | null} hitTest Resolves a click to a hit.
 * @property {(hit: object, options: { signal: AbortSignal }) => Promise<object | null>} loadDetails Fetch the data behind a hit, the signal aborts when the result is no longer needed.
 * @property {(hit: object, details: object | null) => string} renderHtml
 * @property {() => void} clearSelection
 */
/**
 * The single side panel that inspect modes (grid, feature) render into.
 * @param {import('@defra/interactive-map').default} interactiveMap
 * @param {import('ol/Map').default} map
 */
export function registerInfoPanel (interactiveMap, map) {
  const mapContainer = map.getTargetElement()?.closest('.app-map')
  let activeInspector = null
  let isOpen = false
  let pendingLoad = null

  function cancelPendingLoad () {
    pendingLoad?.abort()
    pendingLoad = null
  }

  interactiveMap.addPanel(INFO_PANEL_ID, {
    id: INFO_PANEL_ID,
    label: 'Land model attributes',
    html: renderPanelShellHtml(),
    mobile: { slot: 'drawer', open: false, modal: true, dismissible: true },
    tablet: { slot: 'right-top', open: false, modal: false, width: '460px', dismissible: true },
    desktop: { slot: 'right-top', open: false, modal: false, width: '460px', dismissible: true }
  })

  bindSampleLink(mapContainer, map)

  function open () {
    isOpen = true
    mapContainer?.classList.add(INFO_PANEL_OPEN_CLASS)
    interactiveMap.showPanel(INFO_PANEL_ID, { focus: false })
  }

  function markClosed () {
    isOpen = false
    cancelPendingLoad()
    mapContainer?.classList.remove(INFO_PANEL_OPEN_CLASS)
  }

  function close () {
    markClosed()
    interactiveMap.hidePanel(INFO_PANEL_ID)
  }

  interactiveMap.on(EVENTS.MAP_CLICK, async ({ coords }) => {
    if (!activeInspector) {
      return
    }

    const active = activeInspector
    const hit = active.hitTest(coords)
    cancelPendingLoad()
    if (!hit) {
      active.clearSelection()
      if (isOpen) {
        updateContent(active.emptyHtml)
      }
      return
    }

    pendingLoad = new AbortController()
    open()
    updateContent(LOADING_HTML)
    await showDetails(active, hit, pendingLoad.signal)
  })

  interactiveMap.on(EVENTS.APP_PANEL_CLOSED, ({ panelId }) => {
    if (panelId === INFO_PANEL_ID) {
      markClosed()
      activeInspector?.clearSelection()
    }
  })

  return {
    /** @param {Inspector} next */
    activate (next) {
      cancelPendingLoad()
      activeInspector = next
    },

    /** @param {Inspector} inspector */
    deactivate (inspector) {
      if (activeInspector !== inspector) {
        return
      }
      activeInspector = null
      close()
    }
  }
}
