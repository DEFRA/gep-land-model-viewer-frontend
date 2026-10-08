import { authenticatedFetch } from '../../../../authenticated-fetch.js'
import { toTaxonomyClass, toSource } from '../model.js'
import { CELL_SIZE_METRES } from './cell-at-point.js'

const GRIDS_URL = '/land-model/grids.json'

const BNG_REF = 0
const LAND_USE = 1
const LAND_USE_CODE = 2
const LAND_COVER = 3
const LAND_COVER_CODE = 4
const SOIL = 5
const SOIL_CODE = 6

/** @typedef {{ landCover?: import('../model.js').Source, soils?: import('../model.js').Source }} GridMetadata */
/** @typedef {{ metadata: GridMetadata, lookups: Record<string, string[]>, byBngRef: Map<string, any[]> }} IndexedGrids */
/** @type {Promise<IndexedGrids> | null} */
let gridsPromise = null

function resolve (table, index) {
  return index == null ? null : table[index]
}

/** @returns {import('../model.js').TaxonomyTheme | null} */
function toDominantTheme (label, code, source) {
  if (label == null) {
    return null
  }

  return { dominant: toTaxonomyClass(label, code), ...(source ? { source } : {}) }
}

/**
 * @param {any[]} row
 * @param {Record<string, string[]>} lookups
 * @param {GridMetadata} metadata
 * @returns {import('../model.js').LandModelRecord}
 */
export function toGridRecord (row, lookups, metadata) {
  return {
    unit: { kind: 'grid', bngRef: row[BNG_REF], cellSize: CELL_SIZE_METRES },
    landCover: toDominantTheme(resolve(lookups.land_cover, row[LAND_COVER]), resolve(lookups.land_cover_code, row[LAND_COVER_CODE]), metadata.landCover),
    landUse: toDominantTheme(resolve(lookups.land_use, row[LAND_USE]), resolve(lookups.land_use_code, row[LAND_USE_CODE])),
    ownership: null,
    landManagement: null,
    protectedAreas: null,
    soils: toDominantTheme(resolve(lookups.soil, row[SOIL]), resolve(lookups.soil_code, row[SOIL_CODE]), metadata.soils)
  }
}

/**
 * @param {{ metadata: object, lookups: Record<string, string[]>, rows: any[][] }} data
 * @returns {IndexedGrids}
 */
export function indexGrids ({ metadata: raw, lookups, rows }) {
  const metadata = {
    landCover: toSource(raw.land_cover_source, raw.land_cover_date),
    soils: toSource(raw.soil_source, raw.soil_date)
  }
  const byBngRef = new Map()
  for (const row of rows) {
    byBngRef.set(row[BNG_REF], row)
  }
  return { metadata, lookups, byBngRef }
}

function loadGrids () {
  gridsPromise ??= fetchGrids()
  return gridsPromise
}

async function fetchGrids () {
  try {
    const res = await authenticatedFetch(GRIDS_URL)
    if (!res.ok) {
      throw new Error(`Failed to load grids (${res.status})`)
    }

    return indexGrids(await res.json())
  } catch (err) {
    gridsPromise = null
    throw err
  }
}

/**
 * @param {string} bngRef
 * @returns {Promise<import('../model.js').LandModelRecord | null>}
 */
export async function getGridDetails (bngRef) {
  const { metadata, lookups, byBngRef } = await loadGrids()
  const row = byBngRef.get(bngRef)
  return row ? toGridRecord(row, lookups, metadata) : null
}
