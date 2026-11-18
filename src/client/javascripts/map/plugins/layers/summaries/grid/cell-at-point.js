import { toBngRef } from './bng-reference.js'

// Metres trimmed from each cell
const EDGE_INSET = 0.001

function insetCellExtent (easting, northing, cellSize) {
  return [easting + EDGE_INSET, northing + EDGE_INSET, easting + cellSize - EDGE_INSET, northing + cellSize - EDGE_INSET]
}

export function snapDown (value, step) {
  return Math.floor(value / step) * step
}

export function snapUp (value, step) {
  return Math.ceil(value / step) * step
}

/**
 * @param {number[]} coords
 * @param {import('./resolution.js').GridCellSize} cellSize
 */
export function cellAtPoint ([easting, northing], cellSize) {
  const snappedE = snapDown(easting, cellSize)
  const snappedN = snapDown(northing, cellSize)
  const cellId = toBngRef(snappedE, snappedN, cellSize)
  if (!cellId) {
    return null
  }
  return { cellId, easting: snappedE, northing: snappedN }
}

/**
 * Returns the cells that intersect with the given polygon, minus a small inset from the edges of each
 * cell so that polygons that only touch a cell along an edge or at a corner are not included.
 *
 * @param {import('ol/geom/Polygon').default} polygon
 * @param {import('./resolution.js').GridCellSize} cellSize
 * @returns {Array<NonNullable<ReturnType<typeof cellAtPoint>>>}
 */
export function cellsInPolygon (polygon, cellSize) {
  const [minX, minY, maxX, maxY] = polygon.getExtent()
  const cells = []
  for (let easting = snapDown(minX, cellSize); easting < maxX; easting += cellSize) {
    for (let northing = snapDown(minY, cellSize); northing < maxY; northing += cellSize) {
      if (!polygon.intersectsExtent(insetCellExtent(easting, northing, cellSize))) {
        continue
      }

      const cell = cellAtPoint([easting, northing], cellSize)
      if (cell) {
        cells.push(cell)
      }
    }
  }

  return cells
}
