import { EVENTS } from '@defra/interactive-map'
import { isCoarsePointer } from '../../../pointer.js'
import { INFO_PANEL_ID } from '../constants.js'

/**
 * singleclick waits 250ms to rule out a double-click. Coarse input skips the
 * delay and identifies on plain click.
 * @returns {'click' | 'singleclick'}
 */
function inspectionClickEvent () {
  return isCoarsePointer() ? 'click' : 'singleclick'
}

/**
 * @typedef {object} Hit One selectable result under a click.
 * @property {number} id Position of the corresponding source hit.
 * @property {string} label Shown in the list when several hits share a click.
 * @property {string} [panelTitle] Panel title when it should differ from the hit label.
 * @property {unknown} [details] Previously loaded details cached on the hit.
 */

/**
 * @typedef {object} SourceHit One result returned by a hit source.
 * @property {string} label
 * @property {string} [panelTitle]
 * @property {() => void} [select] Highlight the hit on the map.
 * @property {() => boolean} stillValid Whether the hit is still available.
 * @property {(options: { signal: AbortSignal }) => Promise<unknown>} loadDetails
 * @property {(details: unknown) => import('preact').VNode} render
 */

/**
 * @typedef {object} HitSource
 * @property {(coords: number[], options: { signal: AbortSignal }) => SourceHit[] | Promise<SourceHit[]>} getHits
 * @property {() => void} clearSelection
 */

/**
 * @typedef {object} InspectionOptions
 * @property {import('ol/Map').default} map
 * @property {{ on: Function, off: Function }} eventBus
 * @property {HitSource[]} sources
 * @property {() => import('../reducer.js').InspectionState} getInspectionState
 * @property {(action: object) => void} dispatch
 * @property {(action: object) => void} appDispatch
 * @property {(message: string) => void} announce
 */

function clearSelections (sources) {
  for (const source of sources) {
    source.clearSelection()
  }
}

async function collectHits (sources, coords, signal) {
  const results = await Promise.all(sources.map(async (source) => {
    try {
      return await source.getHits(coords, { signal })
    } catch (err) {
      if (!signal.aborted) {
        console.error('Hit source failed', err)
      }
      return []
    }
  }))

  return results.flat().sort((a, b) => a.label.localeCompare(b.label))
}

class Inspection {
  /** @param {InspectionOptions} options */
  constructor ({ map, eventBus, sources, getInspectionState, dispatch, appDispatch, announce }) {
    this.map = map
    this.eventBus = eventBus
    this.sources = sources
    this.getInspectionState = getInspectionState
    this.dispatch = dispatch
    this.appDispatch = appDispatch
    this.announce = announce
    /** @type {AbortController | null} */
    this.pending = null
    /** @type {Array<SourceHit | null>} */
    this.sourceHits = []
    this.clickEvent = inspectionClickEvent()
    this.handleMapClick = this.handleMapClick.bind(this)
    this.onPanelClosed = this.onPanelClosed.bind(this)

    map.on(this.clickEvent, this.handleMapClick)
    eventBus.on(EVENTS.APP_PANEL_CLOSED, this.onPanelClosed)
  }

  getSourceHit (hit) {
    return this.sourceHits[hit.id]
  }

  cancelPending () {
    this.pending?.abort()
    this.pending = null
  }

  beginRequest () {
    this.cancelPending()
    const controller = new AbortController()
    this.pending = controller
    return controller
  }

  /**
   * @param {Hit} hit
   * @param {{ hits?: Hit[], announceLoading?: boolean }} [options]
   */
  async selectHit (hit, { hits, announceLoading = true } = {}) {
    const sourceHit = this.getSourceHit(hit)
    if (!sourceHit) {
      return
    }

    const controller = this.beginRequest()
    const selectionHits = hits ?? this.getInspectionState().hits

    clearSelections(this.sources)
    sourceHit.select?.()
    this.dispatch({
      type: 'SHOW_HIT',
      payload: { hit, hits: selectionHits }
    })

    if (announceLoading) {
      this.announce('Loading details')
    }

    try {
      const details = hit.details !== undefined
        ? hit.details
        : await sourceHit.loadDetails({ signal: controller.signal }) ?? null

      if (controller.signal.aborted) {
        return
      }

      this.dispatch({ type: 'DETAILS_LOADED', payload: { details } })
      this.announce(`${hit.label} details loaded`)
    } catch (err) {
      if (controller.signal.aborted) {
        return
      }

      console.error('Failed to load details for selection', err)
      this.dispatch({ type: 'DETAILS_FAILED' })
      this.announce('Could not load details')
    } finally {
      if (this.pending === controller) {
        this.pending = null
      }
    }
  }

  async handleMapClick ({ coordinate }) {
    const controller = this.beginRequest()
    this.sourceHits = []
    clearSelections(this.sources)
    this.dispatch({ type: 'SEARCH_STARTED' })
    this.announce('Loading details')

    const collected = await collectHits(this.sources, coordinate, controller.signal)
    if (controller.signal.aborted) {
      return
    }

    this.pending = null
    this.sourceHits = collected.filter(hit => hit.stillValid())
    const hits = this.sourceHits.map(({ label, panelTitle }, id) => ({ id, label, panelTitle }))

    if (!hits.length) {
      this.dispatch({ type: 'SHOW_EMPTY' })
      this.announce('No information found at this location')
      return
    }

    this.appDispatch({
      type: 'OPEN_PANEL',
      payload: { panelId: INFO_PANEL_ID, focusOnOpen: false }
    })

    if (hits.length === 1) {
      await this.selectHit(hits[0], { hits, announceLoading: false })
      return
    }

    this.dispatch({ type: 'SHOW_LIST', payload: { hits } })
    this.announce(`${hits.length} layers found at this location`)
  }

  showHitList () {
    const hits = this.getInspectionState().hits
    this.cancelPending()
    clearSelections(this.sources)
    this.dispatch({ type: 'SHOW_LIST', payload: { hits } })
    this.announce(`${hits.length} layers selected`)
  }

  reconcile () {
    const { hits, hit } = this.getInspectionState()
    if (!hits.length) {
      return
    }

    const remaining = []
    for (const candidate of hits) {
      if (this.getSourceHit(candidate)?.stillValid()) {
        remaining.push(candidate)
      } else {
        this.sourceHits[candidate.id] = null
      }
    }

    if (remaining.length === hits.length) {
      return
    }

    if (remaining.includes(hit)) {
      this.dispatch({ type: 'SET_HITS', payload: { hits: remaining } })
      return
    }

    if (remaining.length === 1) {
      this.selectHit(remaining[0], { hits: remaining })
      return
    }

    this.cancelPending()
    clearSelections(this.sources)
    if (!remaining.length) {
      this.sourceHits = []
      this.appDispatch({ type: 'CLOSE_PANEL', payload: INFO_PANEL_ID })
    } else {
      this.dispatch({ type: 'SHOW_LIST', payload: { hits: remaining } })
      this.announce(`${remaining.length} layers selected`)
    }
  }

  renderHit (hit) {
    return this.getSourceHit(hit)?.render(hit.details) ?? null
  }

  onPanelClosed ({ panelId }) {
    if (panelId !== INFO_PANEL_ID) {
      return
    }

    this.cancelPending()
    this.sourceHits = []
    clearSelections(this.sources)
    this.dispatch({ type: 'RESET_INSPECTION' })
  }

  dispose () {
    this.cancelPending()
    this.sourceHits = []
    clearSelections(this.sources)
    this.map.un(this.clickEvent, this.handleMapClick)
    this.eventBus.off(EVENTS.APP_PANEL_CLOSED, this.onPanelClosed)
  }
}

/** @param {InspectionOptions} options */
export function createInspection (options) {
  return new Inspection(options)
}
