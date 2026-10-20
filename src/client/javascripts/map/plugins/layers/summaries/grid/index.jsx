import { GRID_SUMMARY } from '../config.js'
import { cellAtPoint } from './cell-at-point.js'
import { cellSizeAtZoom } from './resolution.js'
import { getGridDetails } from './data.js'
import { createGridLayer } from './grid-layer.js'
import { LandSummaryView } from '../components/LandSummaryView.jsx'

/**
 * @param {{ on: Function, off: Function }} eventBus
 * @param {import('ol/Map').default} map
 * @param {() => import('../../reducer.js').LayerState[]} getLayers Current layer state
 */
export function createGridSummary (eventBus, map, getLayers) {
  const gridLayer = createGridLayer(eventBus, map)
  const view = map.getView()
  let visible = false

  // The grid only shows once its layer has loaded, so its source has the release's file URLs and band descriptions.
  function gridSource () {
    return /** @type {import('./api.js').GridSource} */ (getLayers().find(layer => layer.id === GRID_SUMMARY.id).source)
  }

  return {
    setVisible (next) {
      visible = next
      gridLayer.setEnabled(next)
    },

    setZIndex (zIndex) {
      gridLayer.setZIndex(zIndex)
    },

    getHits (coords) {
      if (!visible) {
        return []
      }

      const cellSize = cellSizeAtZoom(view.getZoom())
      const cell = cellAtPoint(coords, cellSize)
      if (!cell) {
        return []
      }

      /** @type {import('../model.js').GridUnit} */
      const unit = { kind: 'grid', bngRef: cell.cellId.compact, cellSize }
      const extent = [cell.easting, cell.northing, cell.easting + cellSize, cell.northing + cellSize]

      return [{
        label: 'Grid square',
        stillValid: () => visible,
        select: () => gridLayer.highlightCell(cell.easting, cell.northing, cellSize),
        loadDetails: () => getGridDetails(unit, extent, gridSource()),
        render: details => <LandSummaryView record={details} unit={unit} />
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
