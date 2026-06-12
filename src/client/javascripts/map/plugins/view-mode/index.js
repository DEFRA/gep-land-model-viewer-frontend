import { EVENTS } from '@defra/interactive-map'
import { VIEW_MODE_BUTTON_ID, VIEW_MODE_CONTENT_ID, VIEW_MODE_DEFAULT, VIEW_MODE_PANEL_ID, VIEW_MODES } from './constants.js'
import { createViewModeButtonConfig } from './plugin.js'
import { renderViewModePanelHtml } from './render.js'

export { default as createViewModePlugin } from './plugin.js'

/**
 * OL ignores minZoom on views with a resolutions array and constrainResolution
 * enabled (https://github.com/openlayers/openlayers/issues/16344). The fix
 * suggested there is to slice the resolutions array, but that renumbers our
 * zoom levels, so patch the resolution constraint instead.
 * Re-apply after any setMinZoom/setMaxZoom call as those rebuild the constraints.
 * @param {import('ol/View').default} view
 * @param {() => number | null} getLockedMinZoom
 */
export function applyResolutionLock (view, getLockedMinZoom) {
  const constraints = view.getConstraints()
  const base = constraints.resolution
  constraints.resolution = (resolution, delta, size, isMoving) => {
    const constrained = base(resolution, delta, size, isMoving)
    const lockedMinZoom = getLockedMinZoom()
    if (constrained === undefined || lockedMinZoom === null) {
      return constrained
    }

    return Math.min(constrained, view.getResolutionForZoom(lockedMinZoom))
  }
}

/**
 * @param {import('@defra/interactive-map').default} interactiveMap
 * @param {import('ol/View').default} view
 */
function syncZoomButtonState (interactiveMap, view) {
  interactiveMap.emit(EVENTS.MAP_MOVE, {
    zoom: view.getZoom(),
    isAtMaxZoom: view.getZoom() >= view.getMaxZoom(),
    isAtMinZoom: view.getZoom() <= view.getMinZoom()
  })
}

function renderPanel (mode) {
  const el = document.getElementById(VIEW_MODE_CONTENT_ID)
  if (el) {
    el.innerHTML = renderViewModePanelHtml(mode)
  }
}

/** @typedef {import('../info-panel/controller.js').InspectController} InspectController */
/**
 * @param {import('@defra/interactive-map').default} interactiveMap
 * @param {import('ol/Map').default} map
 * @param {{ grid: InspectController, feature: InspectController }} controllers
 */
export function registerViewMode (interactiveMap, map, { grid, feature }) {
  const view = map.getView()
  let mode = VIEW_MODE_DEFAULT
  let lockedMinZoom = null
  const originalMinZoom = view.getMinZoom()

  applyResolutionLock(view, () => lockedMinZoom)

  function setMinZoomWithLock (minZoom) {
    view.setMinZoom(minZoom)
    applyResolutionLock(view, () => lockedMinZoom)
  }

  const controllers = {
    [VIEW_MODES.GRID]: grid,
    [VIEW_MODES.FEATURE]: feature
  }

  function applyMode (next) {
    const active = controllers[next]
    for (const controller of Object.values(controllers)) {
      if (controller !== active) {
        controller.setVisible(false)
      }
    }

    if (active) {
      lockedMinZoom = active.minZoom
      if (view.getZoom() < active.minZoom) {
        const center = view.getCenter()
        view.animate({
          center: [center[0], center[1]],
          zoom: active.minZoom
        }, () => {
          if (mode === next) {
            setMinZoomWithLock(active.minZoom)
          }
        })
      } else {
        setMinZoomWithLock(active.minZoom)
      }
      active.setVisible(true)
    } else {
      lockedMinZoom = null
      setMinZoomWithLock(originalMinZoom)
    }
    syncZoomButtonState(interactiveMap, view)
  }

  function setMode (next) {
    if (next === mode) {
      return
    }
    mode = next
    applyMode(next)
    renderPanel(mode)
    interactiveMap.addButton(VIEW_MODE_BUTTON_ID, createViewModeButtonConfig(mode))
    interactiveMap.hidePanel(VIEW_MODE_PANEL_ID)
  }

  interactiveMap.on(EVENTS.APP_PANEL_OPENED, ({ panelId }) => {
    if (panelId === VIEW_MODE_PANEL_ID) {
      renderPanel(mode)
    }
  })

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-app-view-mode]')
    if (!button) {
      return
    }
    setMode(button.dataset.appViewMode)
  })
}
