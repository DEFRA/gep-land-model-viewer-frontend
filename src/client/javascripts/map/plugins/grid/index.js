import { cellAtPoint } from './cell-at-point.js'
import { GRID_VISIBLE_MIN_ZOOM } from './constants.js'
import { getGridDetails } from './data.js'
import { createGridLayer } from './grid-layer.js'
import { createInspectController } from '../info-panel/controller.js'
import { renderEmptyStateHtml, renderCellInfoHtml } from './render.js'

/**
 * @param {import('@defra/interactive-map').default} interactiveMap
 * @param {import('ol/Map').default} map
 * @param {ReturnType<import('../info-panel/index.js').registerInfoPanel>} infoPanel
 */
export function registerGridController (interactiveMap, map, infoPanel) {
  const gridLayer = createGridLayer(interactiveMap, map)

  const inspector = {
    emptyHtml: renderEmptyStateHtml(),

    hitTest (coords) {
      const cell = cellAtPoint(coords)
      if (!cell) {
        return null
      }
      gridLayer.highlightCell(cell.easting, cell.northing)
      return cell
    },

    loadDetails (hit) {
      return getGridDetails(hit.cellId.compact)
    },

    renderHtml: renderCellInfoHtml,

    clearSelection () {
      gridLayer.clearHighlight()
    }
  }

  return createInspectController(map, {
    minZoom: GRID_VISIBLE_MIN_ZOOM,
    layer: gridLayer,
    cursorClass: 'app-map--grid',
    inspector,
    infoPanel
  })
}
