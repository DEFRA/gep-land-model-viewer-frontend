/**
 * @typedef {object} InspectController
 * @property {number} minZoom Minimum zoom at which the mode's layer is rendered.
 * @property {(next: boolean) => void} setVisible Show or hide the mode's layer and cursor class.
 */
/**
 * Pairs an inspect mode's layer and Inspector with the shared info panel,
 * returning the controller that view-mode toggles.
 * @param {import('ol/Map').default} map
 * @param {object} options
 * @param {number} options.minZoom
 * @param {{ setEnabled: (next: boolean) => void }} options.layer
 * @param {string} options.cursorClass
 * @param {import('./index.js').Inspector} options.inspector
 * @param {ReturnType<import('./index.js').registerInfoPanel>} options.infoPanel
 * @returns {InspectController}
 */
export function createInspectController (map, { minZoom, layer, cursorClass, inspector, infoPanel }) {
  return {
    minZoom,

    setVisible (next) {
      layer.setEnabled(next)
      map.getTargetElement()?.classList.toggle(cursorClass, next)
      if (next) {
        infoPanel.activate(inspector)
      } else {
        inspector.clearSelection()
        infoPanel.deactivate(inspector)
      }
    }
  }
}
