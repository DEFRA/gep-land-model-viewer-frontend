import { GRID_SUMMARY } from '../config.js'
import { cellAtPoint } from './cell-at-point.js'
import { cellSizeAtZoom } from './resolution.js'
import { getGridDetails } from './data.js'
import { createGridLayer } from './grid-layer.js'
import { combineRecords } from '../combine.js'
import { LandSummaryView } from '../components/LandSummaryView.jsx'
import { SelectionHeader } from '../components/SelectionHeader.jsx'

/**
 * @template T
 * @param {() => Promise<T>} load
 * @returns {() => Promise<T>} Loads once, or again after a failure
 */
function loadOnce (load) {
  let loading = null
  return () => {
    loading ??= load().catch((error) => {
      loading = null
      throw error
    })
    return loading
  }
}

/**
 * @typedef {object} SelectedCell
 * @property {import('../model.js').GridUnit} unit
 * @property {import('ol/extent.js').Extent} extent
 * @property {() => Promise<import('../model.js').LandModelRecord | null>} loadDetails Loads once while the cell is selected
 */

/** @typedef {{ units: import('../model.js').GridUnit[], record: import('../model.js').LandModelThemes | null }} SelectionDetails */

/**
 * @param {import('../model.js').GridUnit} unit
 * @param {import('../model.js').LandModelThemes | null} record
 */
function renderCell (unit, record) {
  return <LandSummaryView record={record} unit={unit} />
}

/** @param {SelectedCell[]} cells */
async function combineCells (cells) {
  const units = await Promise.all(cells.map(async ({ unit, loadDetails }) => ({ record: await loadDetails(), area: unit.cellSize ** 2 })))
  return combineRecords(units)
}

/**
 * @param {SelectedCell[]} selected
 * @param {SelectedCell} cell
 * @returns {SelectedCell[]}
 */
function toggleCell (selected, cell) {
  // a square of another size starts a new selection, so a square and the squares inside it are never both selected
  if (selected[0]?.unit.cellSize !== cell.unit.cellSize) {
    return [cell]
  }

  const isSelected = ({ unit }) => unit.bngRef === cell.unit.bngRef
  return selected.some(isSelected)
    ? selected.filter(candidate => !isSelected(candidate))
    : [...selected, cell]
}

/**
 * @param {{ on: Function, off: Function }} eventBus
 * @param {import('ol/Map').default} map
 * @param {() => import('../../reducer.js').LayerState[]} getLayers Current layer state
 */
export function createGridSummary (eventBus, map, getLayers) {
  const gridLayer = createGridLayer(eventBus, map)
  const view = map.getView()
  let visible = false
  /** @type {SelectedCell[]} */
  let selected = []

  // The grid only shows once its layer has loaded, so its source has the release's file URLs and band descriptions.
  function gridSource () {
    return /** @type {import('./api.js').GridSource} */ (getLayers().find(layer => layer.id === GRID_SUMMARY.id).source)
  }

  /** @returns {SelectedCell | null} */
  function cellAt (coords) {
    if (!visible) {
      return null
    }

    const cellSize = cellSizeAtZoom(view.getZoom())
    const cell = cellAtPoint(coords, cellSize)
    if (!cell) {
      return null
    }

    /** @type {import('../model.js').GridUnit} */
    const unit = { kind: 'grid', bngRef: cell.cellId.compact, cellSize }
    const extent = [cell.easting, cell.northing, cell.easting + cellSize, cell.northing + cellSize]

    return { unit, extent, loadDetails: loadOnce(() => getGridDetails(unit, extent, gridSource())) }
  }

  /** @param {SelectedCell[]} cells */
  function setSelected (cells) {
    selected = cells
    gridLayer.highlightCells(cells.map(({ extent }) => extent))
  }

  /** @type {import('../../inspection/index.js').Selection} */
  const selection = {
    toggleAt (coords) {
      const cell = cellAt(coords)
      if (!cell) {
        return false
      }

      setSelected(toggleCell(selected, cell))
      return true
    },

    isEmpty: () => !selected.length,

    title: () => selected.length === 1 ? 'Grid square' : 'Grid squares',

    label: () => `${selected.length} ${selected.length === 1 ? 'grid square' : 'grid squares'} selected`,

    stillValid: () => visible,

    /** @returns {Promise<SelectionDetails>} */
    async loadDetails () {
      const cells = selected
      const record = cells.length === 1 ? await cells[0].loadDetails() : await combineCells(cells)
      return { units: cells.map(({ unit }) => unit), record }
    },

    render (details) {
      const { units, record } = /** @type {SelectionDetails} */ (details)
      return units.length === 1
        ? renderCell(units[0], record)
        : <LandSummaryView record={record} header={<SelectionHeader count={units.length} label='grid squares' />} />
    }
  }

  return {
    selection,

    setVisible (next) {
      visible = next
      gridLayer.setEnabled(next)
    },

    setZIndex (zIndex) {
      gridLayer.setZIndex(zIndex)
    },

    getHits (coords) {
      const cell = cellAt(coords)
      if (!cell) {
        return []
      }

      return [{
        label: 'Grid square',
        stillValid: () => visible,
        // the square becomes the selection, so Shift + click carries on from it
        select: () => setSelected([cell]),
        loadDetails: cell.loadDetails,
        render: record => renderCell(cell.unit, record)
      }]
    },

    clearSelection () {
      selected = []
      gridLayer.clearHighlight()
    },

    dispose () {
      gridLayer.clearHighlight()
      gridLayer.dispose()
    }
  }
}
