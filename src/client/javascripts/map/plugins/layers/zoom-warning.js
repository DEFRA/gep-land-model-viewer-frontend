// Lucide "zoom-in"
const ZOOM_IN_ICON_SVG = '<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/>'

/**
 * A banner over the map warning that enabled layers are not visible at the
 * current zoom.
 *
 * @param {import('ol/Map.js').default} map
 * @returns {{ set: (id: string, entry: { label: string, minZoom: number, enabled: boolean }) => void }}
 */
export function registerZoomWarning (map) {
  const entries = new Map()

  const element = document.createElement('div')
  element.className = 'app-map__zoom-warning'
  element.hidden = true
  element.innerHTML = `<svg class="app-map__zoom-warning-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">${ZOOM_IN_ICON_SVG}</svg><span></span>`

  map.getOverlayContainerStopEvent().appendChild(element)
  const messageEl = element.querySelector('span')

  // The library marks the container it renders the map into aria-hidden, so
  // the message is announced from a live region outside the map entirely.
  const liveRegion = document.createElement('div')
  liveRegion.className = 'govuk-visually-hidden'
  liveRegion.setAttribute('role', 'status')
  document.body.appendChild(liveRegion)

  let lastMessage = ''

  function composeMessage () {
    const zoom = map.getView().getZoom()
    const belowZoom = [...entries.values()].filter(entry => entry.enabled && zoom < entry.minZoom)
    if (!belowZoom.length) {
      return ''
    }

    if (belowZoom.length === 1) {
      return `Zoom in to see ${belowZoom[0].label}`
    }

    return 'Zoom in to see the selected data layers'
  }

  function refresh () {
    const message = composeMessage()
    if (message === lastMessage) {
      return
    }

    lastMessage = message
    element.hidden = message === ''
    messageEl.textContent = message
    liveRegion.textContent = message
  }

  map.on('moveend', refresh)

  return {
    set (id, { label, minZoom, enabled }) {
      entries.set(id, { label, minZoom, enabled })
      refresh()
    }
  }
}
