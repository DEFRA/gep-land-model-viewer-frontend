import { toBngRef } from './bng-reference.js'

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
