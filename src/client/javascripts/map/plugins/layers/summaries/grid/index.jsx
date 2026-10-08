import { cellAtPoint } from './cell-at-point.js'
import { cellSizeAtZoom } from './resolution.js'
import { getGridDetails, SAMPLE_CELL_SIZE } from './data.js'
import { createGridLayer } from './grid-layer.js'
import { LandSummaryView } from '../components/LandSummaryView.jsx'

/**
 * @param {{ on: Function, off: Function }} eventBus
 * @param {import('ol/Map').default} map
 */
export function createGridSummary (eventBus, map) {
  const gridLayer = createGridLayer(eventBus, map)
  const view = map.getView()
  let visible = false

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

      const sampled = cellSize === SAMPLE_CELL_SIZE
      /** @type {import('../model.js').GridUnit} */
      const unit = { kind: 'grid', bngRef: cell.cellId.compact, cellSize }

      return [{
        label: 'Grid square',
        stillValid: () => visible,
        select: () => gridLayer.highlightCell(cell.easting, cell.northing, cellSize),
        loadDetails: (_options) => sampled ? getGridDetails(unit.bngRef) : Promise.resolve(null),
        render: details => <LandSummaryView record={details} unit={unit} outsideSampleArea={sampled && !details} />
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
