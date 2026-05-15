import { EVENTS } from '@defra/interactive-map'
import { cellAtPoint } from './cell-at-point.js'
import { GRID_VISIBLE_MIN_ZOOM } from './constants.js'
import { createGridLayer } from './grid-layer.js'
import { renderInitialInfoPanelHtml, renderCellInfoHtml } from './render.js'

const PANEL_ID = 'gep-grid-info'
const CONTENT_ID = 'gep-grid-info-content'
const GRID_INFO_OPEN_CLASS = 'app-map--grid-info-open'

/**
 * @typedef {object} GridController
 * @property {number} minZoom Minimum zoom at which the grid is rendered.
 * @property {(next: boolean) => void} setVisible Show or hide the grid layer and its cursor class.
 */
/** @param {import('ol/Map').default} map */
export function registerGridController (interactiveMap, map) {
  const gridLayer = createGridLayer(interactiveMap, map)
  const mapContainer = map.getTargetElement()?.closest('.app-map')
  let isVisible = false

  function updatePanelContent (innerHtml) {
    const el = document.getElementById(CONTENT_ID)
    if (el) {
      el.innerHTML = innerHtml
    }
  }

  interactiveMap.addPanel(PANEL_ID, {
    id: PANEL_ID,
    label: 'Land model attributes',
    html: renderInitialInfoPanelHtml(CONTENT_ID),
    mobile: { slot: 'drawer', open: false, modal: true, dismissible: true },
    tablet: { slot: 'right-top', open: false, modal: false, width: '320px', dismissible: true },
    desktop: { slot: 'right-top', open: false, modal: false, width: '320px', dismissible: true }
  })

  let clickTimeout = null
  function clearPendingClick () {
    if (clickTimeout) {
      clearTimeout(clickTimeout)
      clickTimeout = null
    }
  }

  function hideGridState () {
    clearPendingClick()
    gridLayer.clearHighlight()
    mapContainer?.classList.remove(GRID_INFO_OPEN_CLASS)
    interactiveMap.hidePanel(PANEL_ID)
  }

  interactiveMap.on(EVENTS.MAP_CLICK, ({ coords }) => {
    if (!isVisible) {
      return
    }
    if (clickTimeout) {
      clearPendingClick()
      return
    }
    clickTimeout = setTimeout(() => {
      clickTimeout = null
      if (!isVisible) {
        return
      }
      const cell = cellAtPoint(coords)
      gridLayer.highlightCell(cell.easting, cell.northing)
      updatePanelContent(renderCellInfoHtml(cell))
      mapContainer?.classList.add(GRID_INFO_OPEN_CLASS)
      interactiveMap.showPanel(PANEL_ID, { focus: false })
    }, 250)
  })

  interactiveMap.on(EVENTS.APP_PANEL_CLOSED, ({ panelId }) => {
    if (panelId === PANEL_ID) {
      gridLayer.clearHighlight()
      mapContainer?.classList.remove(GRID_INFO_OPEN_CLASS)
    }
  })

  return {
    minZoom: GRID_VISIBLE_MIN_ZOOM,

    setVisible (next) {
      isVisible = next
      gridLayer.setEnabled(next)
      map.getTargetElement()?.classList.toggle('app-map--grid', next)
      if (!next) {
        hideGridState()
      }
    }
  }
}
