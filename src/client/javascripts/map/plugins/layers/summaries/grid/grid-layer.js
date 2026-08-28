import { EVENTS } from '@defra/interactive-map'
import Feature from 'ol/Feature.js'
import LineString from 'ol/geom/LineString.js'
import Polygon from 'ol/geom/Polygon.js'
import VectorSource from 'ol/source/Vector.js'
import WebGLVectorLayer from 'ol/layer/WebGLVector.js'
import { CELL_SIZE_METRES, snapDown, snapUp } from './cell-at-point.js'
import { GRID_VISIBLE_MIN_ZOOM } from './constants.js'
import { GOVUK_DARK_GREY, DEFRA_GREEN, DEFRA_GREEN_DARK, withAlpha } from '../../../../config/colours.js'
import { OVERLAY_Z_INDEX } from '../../../../config/layers.js'

const MAX_LINES_PER_AXIS = 1000
const GRID_PAD_SCREEN_PIXELS = 512
const GRID_MIN_PAD_CELLS = 80
const GRID_REDRAW_MARGIN_FACTOR = 0.75

const GRID_LINE_STYLE = {
  'stroke-color': GOVUK_DARK_GREY,
  'stroke-width': 1
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
    highlightCell (easting, northing) {
      selectedSource.clear()
      selectedSource.addFeature(buildHighlightFeature(easting, northing))
    },

    clearHighlight () {
      selectedSource.clear()
    },

    setEnabled (next) {
      enabled = next
      selectedLayer.setVisible(next)
      if (!next) {
        grid.clear()
      }
      scheduleRefresh()
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
    style: GRID_LINE_STYLE,
    zIndex: OVERLAY_Z_INDEX
  })

  const selectedLayer = new WebGLVectorLayer({
    source: selectedSource,
    style: HIGHLIGHT_STYLE,
    zIndex: OVERLAY_Z_INDEX
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

  function viewportInsideRedrawExtent () {
    if (!drawnGrid) {
      return false
    }
    const viewportExtent = map.getView().calculateExtent(map.getSize())
    const redrawMargin = drawnGrid.paddingMetres * GRID_REDRAW_MARGIN_FACTOR
    const redrawExtent = [
      drawnGrid.extent[0] + redrawMargin,
      drawnGrid.extent[1] + redrawMargin,
      drawnGrid.extent[2] - redrawMargin,
      drawnGrid.extent[3] - redrawMargin
    ]
    return (
      viewportExtent[0] >= redrawExtent[0] &&
      viewportExtent[1] >= redrawExtent[1] &&
      viewportExtent[2] <= redrawExtent[2] &&
      viewportExtent[3] <= redrawExtent[3]
    )
  }

  function refreshGrid (enabled) {
    const view = map.getView()
    if (!enabled || view.getZoom() < GRID_VISIBLE_MIN_ZOOM) {
      if (drawnGrid) {
        clearGrid()
      }
      return
    }
    if (viewportInsideRedrawExtent()) {
      return
    }

    const result = buildGridFeatures(map)
    if (!result) {
      clearGrid()
      return
    }

    gridSource.clear()
    gridSource.addFeatures(result.features)
    drawnGrid = {
      extent: result.extent,
      paddingMetres: result.paddingMetres
    }
  }

  return {
    clear: clearGrid,
    refresh: refreshGrid
  }
}

/** @param {import('ol/Map').default} map */
function buildGridFeatures (map) {
  const view = map.getView()
  const viewport = view.calculateExtent(map.getSize())
  const [xmin, ymin, xmax, ymax] = viewport
  const paddingMetres = Math.max(view.getResolution() * GRID_PAD_SCREEN_PIXELS, CELL_SIZE_METRES * GRID_MIN_PAD_CELLS)
  const startE = snapDown(xmin - paddingMetres, CELL_SIZE_METRES)
  const endE = snapUp(xmax + paddingMetres, CELL_SIZE_METRES)
  const startN = snapDown(ymin - paddingMetres, CELL_SIZE_METRES)
  const endN = snapUp(ymax + paddingMetres, CELL_SIZE_METRES)

  const eCount = (endE - startE) / CELL_SIZE_METRES
  const nCount = (endN - startN) / CELL_SIZE_METRES
  if (eCount > MAX_LINES_PER_AXIS || nCount > MAX_LINES_PER_AXIS) {
    return null
  }

  const features = []
  for (let e = startE; e <= endE; e += CELL_SIZE_METRES) {
    features.push(new Feature({ geometry: new LineString([[e, startN], [e, endN]]) }))
  }
  for (let n = startN; n <= endN; n += CELL_SIZE_METRES) {
    features.push(new Feature({ geometry: new LineString([[startE, n], [endE, n]]) }))
  }
  return { features, extent: [startE, startN, endE, endN], paddingMetres }
}

function buildHighlightFeature (easting, northing) {
  return new Feature({
    geometry: new Polygon([[
      [easting, northing],
      [easting + CELL_SIZE_METRES, northing],
      [easting + CELL_SIZE_METRES, northing + CELL_SIZE_METRES],
      [easting, northing + CELL_SIZE_METRES],
      [easting, northing]
    ]])
  })
}
