/** @typedef {10 | 100 | 1000 | 10000 | 100000} GridCellSize */

/** @type {Array<{ minZoom: number, cellSize: GridCellSize }>} */
const GRID_RESOLUTIONS = [
  { minZoom: 11, cellSize: 10 },
  { minZoom: 8, cellSize: 100 },
  { minZoom: 5, cellSize: 1000 },
  { minZoom: 2, cellSize: 10000 },
  { minZoom: 0, cellSize: 100000 }
]

/**
 * Choose grid spacing using the application's UK zoom ladder.
 * @param {number} zoom
 * @returns {GridCellSize}
 */
export function cellSizeAtZoom (zoom) {
  return GRID_RESOLUTIONS.find(level => zoom >= level.minZoom).cellSize
}
