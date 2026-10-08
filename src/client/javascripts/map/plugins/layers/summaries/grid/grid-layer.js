import { EVENTS } from '@defra/interactive-map'
import { buffer, containsExtent } from 'ol/extent.js'
import Feature from 'ol/Feature.js'
import LineString from 'ol/geom/LineString.js'
import Polygon from 'ol/geom/Polygon.js'
import VectorSource from 'ol/source/Vector.js'
import WebGLVectorLayer from 'ol/layer/WebGLVector.js'
import { snapDown, snapUp } from './cell-at-point.js'
import { cellSizeAtZoom } from './resolution.js'
import { DEFRA_GREEN, DEFRA_GREEN_DARK, withAlpha } from '../../../../config/colours.js'
import { SELECTION_Z_INDEX } from '../../../../config/layers.js'
import { GRID_SUMMARY } from '../config.js'

// OpenLayers only redraws WebGL vector layers once the view stops, so the buffer must cover a whole pan.
const GRID_PAD_CELLS = 80
const GRID_REDRAW_MARGIN_FACTOR = 0.75

const GRID_LINE_STYLE = {
  'stroke-color': GRID_SUMMARY.symbol.colour,
  'stroke-width': GRID_SUMMARY.symbol.width
}

const HIGHLIGHT_STYLE = {
  'fill-color': withAlpha(DEFRA_GREEN, 0.25),
  'stroke-color': DEFRA_GREEN_DARK,
  'stroke-width': 2,
  'stroke-line-join': 'miter'
}

/**
 * @param {{ on: Function, off: Function }} eventBus
 * @param {import('ol/Map').default} map
 */
export function createGridLayer (eventBus, map) {
  const { gridSource, selectedSource, gridLayer, selectedLayer } = addGridLayers(map)
  const grid = createBufferedGrid(map, gridSource)
  let enabled = false
  let queued = false

  function scheduleRefresh () {
    if (queued) {
      return
    }
    queued = true
    globalThis.requestAnimationFrame(() => {
      queued = false
      grid.refresh(enabled)
    })
  }

  eventBus.on(EVENTS.MAP_RENDER, scheduleRefresh)
  scheduleRefresh()

  return {
    highlightCell (easting, northing, cellSize) {
      selectedSource.clear()
      selectedSource.addFeature(buildHighlightFeature(easting, northing, cellSize))
    },

    clearHighlight () {
      selectedSource.clear()
    },

    setEnabled (next) {
      if (enabled === next) {
        return
      }

      enabled = next
      selectedLayer.setVisible(next)
      if (!next) {
        grid.clear()
      }
      scheduleRefresh()
    },

    setZIndex (zIndex) {
      gridLayer.setZIndex(zIndex)
    },

    dispose () {
      eventBus.off(EVENTS.MAP_RENDER, scheduleRefresh)
      map.removeLayer(gridLayer)
      map.removeLayer(selectedLayer)
    }
  }
}

/** @param {import('ol/Map').default} map */
function addGridLayers (map) {
  const gridSource = new VectorSource()
  const selectedSource = new VectorSource()

  const gridLayer = new WebGLVectorLayer({
    source: gridSource,
    style: GRID_LINE_STYLE
  })

  const selectedLayer = new WebGLVectorLayer({
    source: selectedSource,
    style: HIGHLIGHT_STYLE,
    visible: false,
    zIndex: SELECTION_Z_INDEX
  })

  map.addLayer(gridLayer)
  map.addLayer(selectedLayer)

  return { gridSource, selectedSource, gridLayer, selectedLayer }
}

/** @param {import('ol/Map').default} map */
function createBufferedGrid (map, gridSource) {
  let drawnGrid = null

  function clearGrid () {
    gridSource.clear()
    drawnGrid = null
  }

  function canReuseDrawnGrid (cellSize) {
    if (drawnGrid?.cellSize !== cellSize) {
      return false
    }

    const redrawExtent = buffer(drawnGrid.extent, -cellSize * GRID_PAD_CELLS * GRID_REDRAW_MARGIN_FACTOR)
    return containsExtent(redrawExtent, map.getView().calculateExtent(map.getSize()))
  }

  function refreshGrid (enabled) {
    if (!enabled) {
      if (drawnGrid) {
        clearGrid()
      }
      return
    }

    const cellSize = cellSizeAtZoom(map.getView().getZoom())
    if (canReuseDrawnGrid(cellSize)) {
      return
    }

    const { features, extent } = buildGridFeatures(map, cellSize)
    gridSource.clear()
    gridSource.addFeatures(features)
    drawnGrid = { extent, cellSize }
  }

  return {
    clear: clearGrid,
    refresh: refreshGrid
  }
}

/**
 * @param {import('ol/Map').default} map
 * @param {import('./resolution.js').GridCellSize} cellSize
 */
function buildGridFeatures (map, cellSize) {
  const [xmin, ymin, xmax, ymax] = map.getView().calculateExtent(map.getSize())
  const paddingMetres = cellSize * GRID_PAD_CELLS
  const startE = snapDown(xmin - paddingMetres, cellSize)
  const endE = snapUp(xmax + paddingMetres, cellSize)
  const startN = snapDown(ymin - paddingMetres, cellSize)
  const endN = snapUp(ymax + paddingMetres, cellSize)

  const features = []
  for (let e = startE; e <= endE; e += cellSize) {
    features.push(new Feature({ geometry: new LineString([[e, startN], [e, endN]]) }))
  }
  for (let n = startN; n <= endN; n += cellSize) {
    features.push(new Feature({ geometry: new LineString([[startE, n], [endE, n]]) }))
  }
  return { features, extent: [startE, startN, endE, endN] }
}

function buildHighlightFeature (easting, northing, cellSize) {
  return new Feature({
    geometry: new Polygon([[
      [easting, northing],
      [easting + cellSize, northing],
      [easting + cellSize, northing + cellSize],
      [easting, northing + cellSize],
      [easting, northing]
    ]])
  })
}
