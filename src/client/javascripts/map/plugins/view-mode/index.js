import { EVENTS } from '@defra/interactive-map'
import { VIEW_MODE_BUTTON_ID, VIEW_MODE_CONTENT_ID, VIEW_MODE_DEFAULT, VIEW_MODE_PANEL_ID, VIEW_MODES } from './constants.js'
import { createViewModeButtonConfig } from './plugin.js'
import { renderViewModePanelHtml } from './render.js'

export { default as createViewModePlugin } from './plugin.js'

/** @param {import('ol/Map').default} map */
export function registerViewMode (interactiveMap, map, { grid }) {
  const view = map.getView()
  let mode = VIEW_MODE_DEFAULT
  const originalMinZoom = view.getMinZoom()

  function syncZoomButtonState () {
    interactiveMap.emit(EVENTS.MAP_MOVE, {
      zoom: view.getZoom(),
      isAtMaxZoom: view.getZoom() >= view.getMaxZoom(),
      isAtMinZoom: view.getZoom() <= view.getMinZoom()
    })
  }

  function renderPanel () {
    const el = document.getElementById(VIEW_MODE_CONTENT_ID)
    if (el) {
      el.innerHTML = renderViewModePanelHtml(mode)
    }
  }

  function refreshButton () {
    interactiveMap.addButton(VIEW_MODE_BUTTON_ID, createViewModeButtonConfig(mode))
  }

  function lockGridMinZoom () {
    if (mode === VIEW_MODES.GRID) {
      view.setMinZoom(grid.minZoom)
    }
  }

  function applyMode (next) {
    if (next === VIEW_MODES.GRID) {
      if (view.getZoom() < grid.minZoom) {
        const center = view.getCenter()
        view.animate({
          center: [center[0], center[1]],
          zoom: grid.minZoom
        }, lockGridMinZoom)
      } else {
        lockGridMinZoom()
      }
      grid.setVisible(true)
    } else {
      grid.setVisible(false)
      view.setMinZoom(originalMinZoom)
    }
    syncZoomButtonState()
  }

  function setMode (next) {
    if (next === mode) {
      return
    }
    mode = next
    applyMode(next)
    renderPanel()
    refreshButton()
    interactiveMap.hidePanel(VIEW_MODE_PANEL_ID)
  }

  interactiveMap.on(EVENTS.APP_PANEL_OPENED, ({ panelId }) => {
    if (panelId === VIEW_MODE_PANEL_ID) {
      renderPanel()
    }
  })

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-app-view-mode]')
    if (!button) {
      return
    }
    if (button.getAttribute('aria-disabled') === 'true') {
      return
    }
    setMode(button.dataset.appViewMode)
  })
}
