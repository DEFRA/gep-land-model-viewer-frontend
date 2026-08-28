import { cellAtPoint } from './cell-at-point.js'
import { GRID_VISIBLE_MIN_ZOOM } from './constants.js'
import { getGridDetails } from './data.js'
import { createGridLayer } from './grid-layer.js'
import { CellInfo } from './CellInfo.jsx'

/**
 * @param {{ on: Function, off: Function }} eventBus
 * @param {import('ol/Map').default} map
 */
export function createGridSummary (eventBus, map) {
  const gridLayer = createGridLayer(eventBus, map)
  const view = map.getView()
  let visible = false

  const isAvailable = () => visible && view.getZoom() >= GRID_VISIBLE_MIN_ZOOM

  return {
    setVisible (next) {
      visible = next
      gridLayer.setEnabled(next)
    },

    getHits (coords) {
      if (!isAvailable()) {
        return []
      }

      const cell = cellAtPoint(coords)
      if (!cell) {
        return []
      }

      return [{
        label: 'Grid square',
        stillValid: isAvailable,
        select: () => gridLayer.highlightCell(cell.easting, cell.northing),
        loadDetails: (_options) => getGridDetails(cell.cellId.compact),
        render: details => <CellInfo hit={cell} details={details} />
      }]
    },

    clearSelection () {
      gridLayer.clearHighlight()
    },

    dispose () {
      gridLayer.clearHighlight()
      gridLayer.dispose()
    }
  }
}
