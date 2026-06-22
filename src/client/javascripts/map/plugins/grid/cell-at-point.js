import { toBngRef } from './bng-reference.js'

export const CELL_SIZE_METRES = 10

export function snapDown (value, step) {
  return Math.floor(value / step) * step
}

export function snapUp (value, step) {
  return Math.ceil(value / step) * step
}

export function cellAtPoint ([easting, northing]) {
  const snappedE = snapDown(easting, CELL_SIZE_METRES)
  const snappedN = snapDown(northing, CELL_SIZE_METRES)
  const cellId = toBngRef(snappedE, snappedN, CELL_SIZE_METRES)
  if (!cellId) {
    return null
  }
  return { cellId, easting: snappedE, northing: snappedN }
}
