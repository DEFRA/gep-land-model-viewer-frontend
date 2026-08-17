/**
 * @typedef {object} Inspector
 * @property {(coords: number[]) => object | null} hitTest Resolves a click to a hit, without side effects.
 * @property {(hit: object) => void} select Highlight the hit on the map.
 * @property {(hit: object, options: { signal: AbortSignal }) => Promise<object | null>} loadDetails
 * @property {(hit: object, details: object | null) => string} renderHtml
 * @property {() => void} clearSelection
 */
/**
 * @typedef {object} InspectController
 * @property {number} minZoom Minimum zoom at which the overlay is rendered.
 * @property {(next: boolean) => void} setVisible Show or hide the overlay.
 */
/**
 * Adapts a grid or feature overlay to an info-panel hit source.
 * @param {import('ol/Map').default} map
 * @param {object} options
 * @param {number} options.minZoom
 * @param {{ setEnabled: (next: boolean) => void }} options.layer
 * @param {string} options.label Name shown in the panel's multi-hit list.
 * @param {string} options.panelTitle Panel title while the overlay's details are shown.
 * @param {Inspector} options.inspector
 * @param {ReturnType<import('./index.js').registerInfoPanel>} options.infoPanel
 * @returns {InspectController}
 */
export function createInspectController (map, { minZoom, layer, label, panelTitle, inspector, infoPanel }) {
  const view = map.getView()

  const source = {
    getHits (coords) {
      // The layer is not drawn below minZoom, so ignore clicks there.
      if (view.getZoom() < minZoom) {
        return []
      }

      const hit = inspector.hitTest(coords)
      if (!hit) {
        return []
      }

      return [{
        label,
        panelTitle,
        select: () => inspector.select(hit),
        loadDetails: (options) => inspector.loadDetails(hit, options),
        renderHtml: (details) => inspector.renderHtml(hit, details)
      }]
    },

    clearSelection: () => inspector.clearSelection()
  }

  return {
    minZoom,

    setVisible (next) {
      layer.setEnabled(next)
      if (next) {
        infoPanel.activate(source)
      } else {
        infoPanel.deactivate(source)
      }
    }
  }
}
