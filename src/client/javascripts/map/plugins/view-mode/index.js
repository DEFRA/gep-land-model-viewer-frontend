import { EVENTS } from '@defra/interactive-map'
import { VIEW_MODE_BUTTON_ID, VIEW_MODE_CONTENT_ID, VIEW_MODE_DEFAULT, VIEW_MODE_PANEL_ID, VIEW_MODES } from './constants.js'
import { createViewModeButtonConfig } from './plugin.js'
import { renderViewModePanelHtml } from './render.js'

export { default as createViewModePlugin } from './plugin.js'

export function registerViewMode (interactiveMap, view, { grid }) {
  let mode = VIEW_MODE_DEFAULT
  const originalMinZoom = view.constraints.minZoom

  // interactive-map's zoom buttons read isAtMinZoom/isAtMaxZoom from MAP_MOVE event
  // payloads. Mutating view.constraints.minZoom does not fire a provider event,
  // so we re-emit MAP_MOVE to refresh button state.
  function syncZoomButtonState () {
    interactiveMap.emit(EVENTS.MAP_MOVE, {
      zoom: view.zoom,
      isAtMaxZoom: view.zoom >= view.constraints.maxZoom,
      isAtMinZoom: view.zoom <= view.constraints.minZoom
    })
  }

  function renderPanel () {
    const el = document.getElementById(VIEW_MODE_CONTENT_ID)
    if (el) {
      el.innerHTML = renderViewModePanelHtml(mode)
    }
  }

  function refreshButton () {
    // Re-add the button to update the label in interactive-map's registry.
    interactiveMap.addButton(VIEW_MODE_BUTTON_ID, createViewModeButtonConfig(mode))
  }

  function applyMode (next) {
    if (next === VIEW_MODES.GRID) {
      view.constraints.minZoom = grid.minZoom
      if (view.zoom < grid.minZoom) {
        interactiveMap.setView({
          center: [view.center.x, view.center.y],
          zoom: grid.minZoom
        })
      }
      grid.setVisible(true)
    } else {
      grid.setVisible(false)
      view.constraints.minZoom = originalMinZoom
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

  // The panel is re-mounted from its initial HTML on each open
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
