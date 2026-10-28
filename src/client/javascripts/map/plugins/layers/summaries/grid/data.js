import { toLandModelRecord } from '../land-model-properties.js'
import { readCellValues } from './cell-values.js'
import { readCellProperties } from './cell-properties.js'

// 10m cells are read from the COG and coarser cells from the FGB for their size.
const COG_CELL_SIZE = 10

/**
 * @typedef {object} BandDescription
 * @property {number} band One-based COG band
 * @property {ClassDescription[]} [classes] Absent where the band holds the value itself
 * @typedef {{ bandValue: number, label: string }} ClassDescription
 */

/** @typedef {Record<string, BandDescription>} Bands The grid COG's bands, keyed by the 10m view column each holds */

/**
 * @param {ArrayLike<number>} values The cell's COG band values, first band first
 * @param {Bands} bands
 * @returns {import('../land-model-properties.js').LandModelProperties} The cell's values as 10m view columns
 */
function toCellProperties (values, bands) {
  return Object.fromEntries(Object.entries(bands).map(([column, { band, classes }]) => {
    const value = values[band - 1]
    return [column, classes ? classes.find(candidate => candidate.bandValue === value)?.label ?? null : value]
  }))
}

/**
 * @param {import('../model.js').GridUnit} unit
 * @param {ArrayLike<number>} values The cell's COG band values, first band first
 * @param {Bands} bands
 * @param {import('../land-model-properties.js').Sources} [sources]
 * @returns {import('../model.js').LandModelRecord}
 */
export function toGridRecord (unit, values, bands, sources) {
  return toLandModelRecord(unit, toCellProperties(values, bands), sources)
}

/**
 * @param {import('../model.js').GridUnit} unit
 * @param {import('ol/extent.js').Extent} extent The cell's bounds
 * @param {import('./api.js').GridSource} source The grid layer's source
 * @returns {Promise<import('../model.js').LandModelRecord | null>}
 */
export async function getGridDetails (unit, extent, { url, bands, fgbs, dataSources }) {
  if (unit.cellSize === COG_CELL_SIZE) {
    const values = await readCellValues(url, extent)
    return values ? toGridRecord(unit, values, bands, dataSources) : null
  }

  const properties = await readCellProperties(fgbs[unit.cellSize], unit.bngRef, extent)
  return properties ? toLandModelRecord(unit, properties, dataSources) : null
}
