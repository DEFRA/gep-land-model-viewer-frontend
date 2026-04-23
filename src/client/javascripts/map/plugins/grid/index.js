import { EVENTS } from '@defra/interactive-map'
import { cellAtPoint } from './cell-at-point.js'
import { createGridLayer } from './grid-layer.js'
import { renderInitialInfoPanelHtml, renderCellInfoHtml } from './render.js'

const BUTTON_ID = 'gep-grid-toggle'
const PANEL_ID = 'gep-grid-info'
const CONTENT_ID = 'gep-grid-info-content'

// Lucide "grid-3x3"
const GRID_ICON_SVG = '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>'

export function registerGridPlugin (interactiveMap, arcgisMap, view) {
  const gridLayer = createGridLayer(interactiveMap, arcgisMap, view)
  let enabled = true

  function updatePanelContent (innerHtml) {
    const el = document.getElementById(CONTENT_ID)
    if (el) {
      el.innerHTML = innerHtml
    }
  }

  interactiveMap.addButton(BUTTON_ID, {
    id: BUTTON_ID,
    label: 'Toggle grid',
    iconSvgContent: GRID_ICON_SVG,
    isPressed: true,
    onClick: () => {
      enabled = !enabled
      gridLayer.setEnabled(enabled)
      interactiveMap.toggleButtonState(BUTTON_ID, 'pressed', enabled)
    },
    mobile: { slot: 'right-top', showLabel: false, order: 11 },
    tablet: { slot: 'right-top', showLabel: false, order: 11 },
    desktop: { slot: 'right-top', showLabel: false, order: 11 }
  })

  interactiveMap.toggleButtonState(BUTTON_ID, 'pressed', enabled)
  interactiveMap.toggleButtonState(BUTTON_ID, 'disabled', !gridLayer.canShow())

  let couldShow = gridLayer.canShow()
  interactiveMap.on(EVENTS.MAP_RENDER, () => {
    const canShow = gridLayer.canShow()
    if (canShow !== couldShow) {
      couldShow = canShow
      interactiveMap.toggleButtonState(BUTTON_ID, 'disabled', !canShow)
    }
  })

  interactiveMap.addPanel(PANEL_ID, {
    id: PANEL_ID,
    label: 'Cell info',
    html: renderInitialInfoPanelHtml(CONTENT_ID),
    mobile: { slot: 'drawer', open: false, modal: true, dismissible: true },
    tablet: { slot: 'right-top', open: false, modal: true, width: '320px', dismissible: true },
    desktop: { slot: 'right-top', open: false, modal: true, width: '320px', dismissible: true }
  })

  let clickTimeout = null
  interactiveMap.on(EVENTS.MAP_CLICK, ({ coords }) => {
    if (!gridLayer.isVisible()) {
      return
    }
    if (clickTimeout) {
      clearTimeout(clickTimeout)
      clickTimeout = null
      return
    }
    clickTimeout = setTimeout(() => {
      clickTimeout = null
      const cell = cellAtPoint(coords)
      gridLayer.highlightCell(cell.easting, cell.northing)
      updatePanelContent(renderCellInfoHtml(cell))
      interactiveMap.showPanel(PANEL_ID, { focus: false })
    }, 250)
  })

  interactiveMap.on(EVENTS.APP_PANEL_CLOSED, ({ panelId }) => {
    if (panelId === PANEL_ID) {
      gridLayer.clearHighlight()
    }
  })
}
