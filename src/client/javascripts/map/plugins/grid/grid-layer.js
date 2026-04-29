import { EVENTS } from '@defra/interactive-map'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer.js'
import Graphic from '@arcgis/core/Graphic.js'
import { CELL_SIZE_METRES, snapDown, snapUp } from './cell-at-point.js'
import { GRID_VISIBLE_MIN_ZOOM } from './constants.js'

const GRID_LAYER_ID = 'gep-grid'
const SELECTED_LAYER_ID = 'gep-grid-selected'
const MAX_LINES_PER_AXIS = 400

const GOVUK_BLUE = [29, 112, 184] // #1d70b8
const DEFRA_GREEN = [0, 133, 49] // #008531
const DEFRA_GREEN_DARK = [0, 106, 39] // #006a27

const LINE_SYMBOL = {
  type: 'simple-line',
  color: [...GOVUK_BLUE, 0.7],
  width: 1
}

const SELECTED_SYMBOL = {
  type: 'simple-fill',
  color: [...DEFRA_GREEN, 0.25],
  outline: { color: [...DEFRA_GREEN_DARK, 1], width: 2, join: 'miter' }
}

export function createGridLayer (interactiveMap, arcgisMap, view) {
  const gridLayer = new GraphicsLayer({ id: GRID_LAYER_ID, listMode: 'hide' })
  const selectedLayer = new GraphicsLayer({ id: SELECTED_LAYER_ID, listMode: 'hide' })
  arcgisMap.add(gridLayer)
  arcgisMap.add(selectedLayer)

  let enabled = false

  function refreshGrid () {
    gridLayer.removeAll()
    if (!enabled || view.zoom < GRID_VISIBLE_MIN_ZOOM) {
      return
    }
    const graphics = buildGridGraphics(view)
    if (graphics.length) {
      gridLayer.addMany(graphics)
    }
  }

  let queued = false
  function scheduleRefresh () {
    if (queued) {
      return
    }
    queued = true
    globalThis.requestAnimationFrame(() => {
      queued = false
      refreshGrid()
    })
  }

  interactiveMap.on(EVENTS.MAP_RENDER, scheduleRefresh)
  scheduleRefresh()

  return {
    highlightCell (easting, northing) {
      selectedLayer.removeAll()
      selectedLayer.add(buildHighlightGraphic(easting, northing))
    },

    clearHighlight () {
      selectedLayer.removeAll()
    },

    setEnabled (next) {
      enabled = next
      selectedLayer.visible = next
      scheduleRefresh()
    }
  }
}

function buildGridGraphics (view) {
  const { xmin, ymin, xmax, ymax } = view.extent
  const padMetres = Math.max(view.resolution * 128, CELL_SIZE_METRES * 20)
  const startE = snapDown(xmin - padMetres, CELL_SIZE_METRES)
  const endE = snapUp(xmax + padMetres, CELL_SIZE_METRES)
  const startN = snapDown(ymin - padMetres, CELL_SIZE_METRES)
  const endN = snapUp(ymax + padMetres, CELL_SIZE_METRES)

  const eCount = (endE - startE) / CELL_SIZE_METRES
  const nCount = (endN - startN) / CELL_SIZE_METRES
  if (eCount > MAX_LINES_PER_AXIS || nCount > MAX_LINES_PER_AXIS) {
    return []
  }

  const graphics = []
  for (let e = startE; e <= endE; e += CELL_SIZE_METRES) {
    graphics.push(buildLineGraphic([[e, startN], [e, endN]]))
  }
  for (let n = startN; n <= endN; n += CELL_SIZE_METRES) {
    graphics.push(buildLineGraphic([[startE, n], [endE, n]]))
  }
  return graphics
}

function buildLineGraphic (path) {
  return new Graphic({
    geometry: {
      type: 'polyline',
      spatialReference: { wkid: 27700 },
      paths: [path]
    },
    symbol: LINE_SYMBOL
  })
}

function buildHighlightGraphic (easting, northing) {
  return new Graphic({
    geometry: {
      type: 'polygon',
      spatialReference: { wkid: 27700 },
      rings: [[
        [easting, northing],
        [easting + CELL_SIZE_METRES, northing],
        [easting + CELL_SIZE_METRES, northing + CELL_SIZE_METRES],
        [easting, northing + CELL_SIZE_METRES],
        [easting, northing]
      ]]
    },
    symbol: SELECTED_SYMBOL
  })
}
