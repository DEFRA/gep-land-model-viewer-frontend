import { EVENTS } from '@defra/interactive-map'
import { INFO_PANEL_ID } from '../constants.js'

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
 * A hit source's selection of one or more land summary units, shown together in the panel.
 *
 * @typedef {object} Selection
 * @property {(coords: number[]) => boolean} toggleAt Adds or removes the unit at the coords; false when there is no unit there.
 * @property {() => boolean} isEmpty
 * @property {() => string} title Panel title, e.g. "Grid squares".
 * @property {() => string} label Announced on each change, e.g. "4 grid squares selected".
 * @property {() => boolean} stillValid Whether the selection can still be shown.
 * @property {(options: { signal: AbortSignal }) => Promise<unknown>} loadDetails Details of the units selected when called.
 * @property {(details: unknown) => import('preact').VNode} render Draws the loaded details only.
 */

/**
 * @typedef {object} HitSource
 * @property {(coords: number[], options: { signal: AbortSignal }) => SourceHit[] | Promise<SourceHit[]>} getHits
 * @property {() => void} clearSelection Removes the source's highlight and empties its selection.
 * @property {Selection} [selection]
 */

/**
 * @typedef {object} InspectionOptions
 * @property {import('ol/Map').default} map
 * @property {{ on: Function, off: Function, emit: Function }} eventBus
 * @property {HitSource[]} sources
 * @property {() => import('../reducer.js').InspectionState} getInspectionState
 * @property {(action: object) => void} dispatch
 * @property {(action: object) => void} appDispatch
 * @property {(message: string) => void} announce
 */

function clearSourceSelections (sources) {
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
    /** @type {Selection | null} */
    this.shownSelection = null
    this.panelOpen = false
    this.handleMapClick = this.handleMapClick.bind(this)
    this.handleKeyDown = this.handleKeyDown.bind(this)
    this.onPanelClosed = this.onPanelClosed.bind(this)

    map.on('singleclick', this.handleMapClick)
    document.addEventListener('keydown', this.handleKeyDown)
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

    this.endSelection()
    sourceHit.select?.()
    this.dispatch({
      type: 'SELECT_HIT',
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

  async handleMapClick ({ coordinate, originalEvent }) {
    if (originalEvent?.shiftKey) {
      await this.toggleSelectionAt(coordinate)
      return
    }

    const controller = this.beginRequest()
    this.sourceHits = []
    this.endSelection()
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

    this.openPanel()

    if (hits.length === 1) {
      await this.selectHit(hits[0], { hits, announceLoading: false })
      return
    }

    this.dispatch({ type: 'SHOW_LIST', payload: { hits } })
    this.announce(`${hits.length} layers found at this location`)
  }

  /** @param {number[]} coords */
  async toggleSelectionAt (coords) {
    const source = this.sources.find(candidate => candidate.selection?.toggleAt(coords))
    if (!source) {
      return
    }

    if (source.selection.isEmpty()) {
      this.clearSelection()
      return
    }

    await this.showSelection(source)
  }

  /** @param {HitSource} source */
  async showSelection (source) {
    const { selection } = source
    const controller = this.beginRequest()
    this.sourceHits = []
    this.shownSelection = selection
    clearSourceSelections(this.sources.filter(other => other !== source))

    this.openPanel()
    this.dispatch({ type: 'SHOW_SELECTION', payload: { title: selection.title() } })
    this.announce(selection.label())

    try {
      const details = await selection.loadDetails({ signal: controller.signal })
      if (controller.signal.aborted) {
        return
      }

      this.dispatch({ type: 'SELECTION_DETAILS_LOADED', payload: { details } })
      this.announce(`${selection.label()}, details loaded`)
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

  openPanel () {
    this.panelOpen = true
    this.appDispatch({ type: 'OPEN_PANEL', payload: { panelId: INFO_PANEL_ID, focusOnOpen: false } })
  }

  endSelection () {
    this.shownSelection = null
    clearSourceSelections(this.sources)
  }

  closePanel () {
    this.cancelPending()
    this.sourceHits = []
    this.panelOpen = false
    this.endSelection()
    // Hiding through the event moves focus back to the map when it was in the panel
    this.eventBus.emit(EVENTS.APP_HIDE_PANEL, INFO_PANEL_ID)
  }

  clearSelection () {
    this.closePanel()
    this.announce('Selection cleared')
  }

  /** @param {KeyboardEvent} event */
  handleKeyDown (event) {
    const { target } = event
    // The map prevents Escape's default from its own viewport, but its Escape only clears its label highlight
    const fromMap = target instanceof Node && target.contains(this.map.getTargetElement())
    const handledElsewhere = event.defaultPrevented && !fromMap
    const inField = target instanceof Element && target.matches('input, textarea, select, [contenteditable]')
    if (event.key !== 'Escape' || !this.panelOpen || handledElsewhere || inField) {
      return
    }

    const { hit, selection } = this.getInspectionState()
    this.closePanel()
    if (hit || selection) {
      this.announce('Selection cleared')
    }
  }

  showHitList () {
    const hits = this.getInspectionState().hits
    this.cancelPending()
    clearSourceSelections(this.sources)
    this.dispatch({ type: 'SHOW_LIST', payload: { hits } })
    this.announce(`${hits.length} layers selected`)
  }

  reconcile () {
    if (this.shownSelection) {
      this.reconcileSelection()
      return
    }

    this.reconcileHits()
  }

  reconcileSelection () {
    if (!this.shownSelection.stillValid()) {
      this.closePanel()
    }
  }

  reconcileHits () {
    const { hits, hit } = this.getInspectionState()
    if (!hits.length) {
      if (this.pending) {
        this.cancelPending()
        this.dispatch({ type: 'RESET_INSPECTION' })
      }
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

    if (!remaining.length) {
      this.closePanel()
      return
    }

    this.cancelPending()
    clearSourceSelections(this.sources)
    this.dispatch({ type: 'SHOW_LIST', payload: { hits: remaining } })
    this.announce(`${remaining.length} layers selected`)
  }

  renderHit (hit) {
    return this.getSourceHit(hit)?.render(hit.details) ?? null
  }

  renderSelection (details) {
    return this.shownSelection?.render(details) ?? null
  }

  onPanelClosed ({ panelId }) {
    if (panelId !== INFO_PANEL_ID) {
      return
    }

    this.cancelPending()
    this.sourceHits = []
    this.panelOpen = false
    this.endSelection()
    this.dispatch({ type: 'RESET_INSPECTION' })
  }

  dispose () {
    this.cancelPending()
    this.sourceHits = []
    clearSourceSelections(this.sources)
    this.map.un('singleclick', this.handleMapClick)
    document.removeEventListener('keydown', this.handleKeyDown)
    this.eventBus.off(EVENTS.APP_PANEL_CLOSED, this.onPanelClosed)
  }
}

/** @param {InspectionOptions} options */
export function createInspection (options) {
  return new Inspection(options)
}
