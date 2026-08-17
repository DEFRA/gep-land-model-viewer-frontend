import { EVENTS } from '@defra/interactive-map'
import { isCoarsePointer } from '../../pointer.js'
import { INFO_PANEL_ID, INFO_PANEL_CONTENT_ID, INFO_PANEL_STATUS_ID, INFO_PANEL_OPEN_CLASS, SAMPLE_CENTER, SAMPLE_LINK_CLASS, SAMPLE_ZOOM } from './constants.js'
import { renderPanelShellHtml, renderMessageHtml, renderHitListHtml, renderHitDetailHtml, applyBarStyles } from './render.js'

const PANEL_LABEL = 'Land model attributes'
const LOADING_HTML = renderMessageHtml('Loading details...')
const ERROR_HTML = renderMessageHtml('Could not load details. Try selecting again.')
const EMPTY_HTML = renderMessageHtml('No information found at this location.')
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

function updateContent (innerHtml, { busy = false } = {}) {
  const el = document.getElementById(INFO_PANEL_CONTENT_ID)
  if (!el) {
    return
  }

  saveSectionState(el)
  el.innerHTML = innerHtml
  applyBarStyles(el)
  restoreSectionState(el)

  if (busy) {
    el.setAttribute('aria-busy', 'true')
  } else {
    el.removeAttribute('aria-busy')
  }
}

function announce (message) {
  const el = document.getElementById(INFO_PANEL_STATUS_ID)
  if (el && el.textContent !== message) {
    el.textContent = message
  }
}

function setTitle (text) {
  const heading = document.getElementById(INFO_PANEL_CONTENT_ID)?.closest('.im-c-panel')?.querySelector('.im-c-panel__heading')
  if (heading) {
    heading.textContent = text
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
 * @typedef {object} Hit One selectable result under a click.
 * @property {string} label Shown in the list when several hits share a click.
 * @property {string} [panelTitle] Panel title while the hit's details are shown, defaults to the panel label.
 * @property {() => void} [select] Highlight the hit on the map.
 * @property {() => boolean} [stillValid] Whether the hit's layer is still shown, checked on refreshHits.
 * @property {(options: { signal: AbortSignal }) => Promise<object | null>} loadDetails Fetch the data behind the hit, the signal aborts when the result is no longer needed.
 * @property {(details: object | null) => string} renderHtml
 */
/**
 * @typedef {object} HitSource
 * @property {(coords: number[], options: { signal: AbortSignal }) => Hit[] | Promise<Hit[]>} getHits
 * @property {() => void} clearSelection
 */

function cancelPending (state) {
  state.pending?.abort()
  state.pending = null
}

function clearSelections (state) {
  for (const source of state.sources) {
    source.clearSelection()
  }
}

function isLiveHit (state, hit) {
  return state.sources.has(hit.source) && (hit.stillValid?.() ?? true)
}

function openPanel (state) {
  state.isOpen = true
  state.mapContainer?.classList.add(INFO_PANEL_OPEN_CLASS)
  state.interactiveMap.showPanel(INFO_PANEL_ID, { focus: false })
}

function markClosed (state) {
  state.isOpen = false
  state.currentHit = null
  cancelPending(state)
  setTitle(PANEL_LABEL)
  state.mapContainer?.classList.remove(INFO_PANEL_OPEN_CLASS)
}

function closePanel (state) {
  markClosed(state)
  state.interactiveMap.hidePanel(INFO_PANEL_ID)
}

function showList (state) {
  setTitle(`${state.hits.length} layers selected`)
  updateContent(renderHitListHtml(state.hits))
  announce(`${state.hits.length} layers found at this location`)
}

// The body is kept so refreshHits can repaint it with a fresh back count,
// whether it is the loaded details, the loading message or the error.
function updateDetail (state, body, options) {
  state.detailBody = body
  const backCount = state.hits.length > 1 ? state.hits.length : 0
  updateContent(renderHitDetailHtml(body, backCount), options)
}

async function showHit (state, hit) {
  cancelPending(state)
  state.pending = new AbortController()
  const { signal } = state.pending
  state.currentHit = hit
  hit.select?.()
  setTitle(hit.panelTitle ?? PANEL_LABEL)
  updateDetail(state, LOADING_HTML, { busy: true })
  announce('Loading details')
  try {
    if (hit.details === undefined) {
      hit.details = await hit.loadDetails({ signal }) ?? null
    }
    if (signal.aborted) {
      return
    }
    updateDetail(state, hit.renderHtml(hit.details))
    announce(`${hit.label} details loaded`)
  } catch (err) {
    if (signal.aborted) {
      return
    }
    console.error('Failed to load details for selection', err)
    updateDetail(state, ERROR_HTML)
    announce('Could not load details')
  }
}

async function collectHits (state, coords, signal) {
  const results = await Promise.all([...state.sources].map(async (source) => {
    try {
      const found = await source.getHits(coords, { signal })
      return found.map(hit => ({ ...hit, source }))
    } catch (err) {
      if (!signal.aborted) {
        console.error('Hit source failed', err)
      }
      return []
    }
  }))
  return results.flat().sort((a, b) => a.label.localeCompare(b.label))
}

async function handleMapClick (state, coords) {
  if (!state.sources.size) {
    return
  }

  cancelPending(state)
  clearSelections(state)
  state.hits = []
  state.currentHit = null
  const controller = new AbortController()
  state.pending = controller
  if (state.isOpen) {
    setTitle(PANEL_LABEL)
    updateContent(LOADING_HTML, { busy: true })
  }
  announce('Loading details')

  const collected = await collectHits(state, coords, controller.signal)
  if (controller.signal.aborted) {
    return
  }

  // A source can deactivate while collection is in flight.
  state.hits = collected.filter(hit => isLiveHit(state, hit))
  if (!state.hits.length) {
    if (state.isOpen) {
      updateContent(EMPTY_HTML)
    }
    announce('No information found at this location')
    return
  }

  openPanel(state)
  if (state.hits.length === 1) {
    await showHit(state, state.hits[0])
  } else {
    showList(state)
  }
}

function refreshHits (state) {
  const remaining = state.hits.filter(hit => isLiveHit(state, hit))
  if (remaining.length === state.hits.length) {
    return
  }

  state.hits = remaining
  if (!state.isOpen) {
    return
  }

  if (!state.hits.length) {
    clearSelections(state)
    closePanel(state)
    return
  }

  if (state.currentHit && state.hits.includes(state.currentHit)) {
    updateDetail(state, state.detailBody)
    return
  }

  cancelPending(state)
  clearSelections(state)
  state.currentHit = null
  if (state.hits.length === 1) {
    showHit(state, state.hits[0])
  } else {
    showList(state)
  }
}

function bindHitClicks (state) {
  state.mapContainer?.addEventListener('click', (event) => {
    const row = event.target.closest('[data-app-hit-index]')
    if (row) {
      const hit = state.hits[Number(row.dataset.appHitIndex)]
      if (hit) {
        showHit(state, hit)
      }
      return
    }

    if (event.target.closest('[data-app-hit-back]')) {
      cancelPending(state)
      clearSelections(state)
      state.currentHit = null
      showList(state)
    }
  })
}

/**
 * The shared info panel. A click asks every active hit source for hits: one
 * hit opens its details directly, several show a list to pick from.
 * @param {import('@defra/interactive-map').default} interactiveMap
 * @param {import('ol/Map').default} map
 */
export function registerInfoPanel (interactiveMap, map) {
  const state = {
    interactiveMap,
    mapContainer: map.getTargetElement()?.closest('.app-map'),
    sources: new Set(),
    hits: [],
    currentHit: null,
    detailBody: null,
    isOpen: false,
    pending: null
  }

  interactiveMap.addPanel(INFO_PANEL_ID, {
    id: INFO_PANEL_ID,
    label: PANEL_LABEL,
    html: renderPanelShellHtml(),
    mobile: { slot: 'drawer', open: false, modal: true, dismissible: true },
    tablet: { slot: 'right-top', open: false, modal: false, width: '460px', dismissible: true },
    desktop: { slot: 'right-top', open: false, modal: false, width: '460px', dismissible: true }
  })

  bindSampleLink(state.mapContainer, map)
  bindHitClicks(state)

  // singleclick waits 250ms to rule out a double-click. Coarse input skips
  // the delay and identifies on plain click.
  map.on(isCoarsePointer() ? 'click' : 'singleclick', (event) => handleMapClick(state, event.coordinate))

  interactiveMap.on(EVENTS.APP_PANEL_CLOSED, ({ panelId }) => {
    if (panelId === INFO_PANEL_ID) {
      markClosed(state)
      clearSelections(state)
      state.hits = []
    }
  })

  return {
    /** @param {HitSource} source */
    activate (source) {
      state.sources.add(source)
    },

    /** @param {HitSource} source */
    deactivate (source) {
      if (!state.sources.delete(source)) {
        return
      }
      source.clearSelection()
      refreshHits(state)
    },

    refreshHits: () => refreshHits(state)
  }
}
