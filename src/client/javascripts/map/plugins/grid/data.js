import { authenticatedFetch } from '../../authenticated-fetch.js'
import { toDate } from '../info-panel/render.js'

const GRIDS_URL = '/land-model/grids.json'

const LAND_USE = 1
const LAND_USE_CODE = 2
const LAND_COVER = 3
const LAND_COVER_CODE = 4
const SOIL = 5
const SOIL_CODE = 6
const ELEVATION_MIN = 7
const ELEVATION_MEAN = 8
const ELEVATION_MAX = 9
const SLOPE_MIN = 10
const SLOPE_MODE = 11
const SLOPE_MAX = 12
const ASPECT = 13

/**
 * @typedef {object} GridCell
 * @property {string} bngRef
 * @property {{ label: string | null, code: string | null }} landUse
 * @property {{ label: string | null, code: string | null, source: string, date: Date | null }} landCover
 * @property {{ label: string | null, code: string | null, source: string, date: Date | null }} soil
 * @property {{ source: string, date: Date | null }} topography
 * @property {{ min: number | null, mean: number | null, max: number | null, mode: null }} elevation
 * @property {{ min: number | null, mode: number | null, max: number | null, mean: null }} slope
 * @property {{ label: string | null, mean: null }} aspect
 */

/** @type {Promise<{ metadata: object, lookups: Record<string, string[]>, byBngRef: Map<string, any[]> }> | null} */
let gridsPromise = null

function resolve (table, index) {
  if (index == null) {
    return null
  }
  return table[index]
}

function parseMetadata (raw) {
  return {
    landCover: {
      source: raw.land_cover_source,
      date: toDate(raw.land_cover_date)
    },
    soil: {
      source: raw.soil_source,
      date: toDate(raw.soil_date)
    },
    topography: {
      source: raw.topography_source,
      date: toDate(raw.topography_date)
    }
  }
}

/**
 * @param {any[]} row
 * @param {Record<string, string[]>} lookups
 * @param {object} metadata
 * @returns {GridCell}
 */
export function toGridCell (row, lookups, metadata) {
  const aspect = resolve(lookups.aspect_aspect, row[ASPECT])
  return {
    bngRef: row[0],
    landUse: {
      label: resolve(lookups.land_use, row[LAND_USE]),
      code: resolve(lookups.land_use_code, row[LAND_USE_CODE])
    },
    landCover: {
      label: resolve(lookups.land_cover, row[LAND_COVER]),
      code: resolve(lookups.land_cover_code, row[LAND_COVER_CODE]),
      source: metadata.landCover.source,
      date: metadata.landCover.date
    },
    soil: {
      label: resolve(lookups.soil, row[SOIL]),
      code: resolve(lookups.soil_code, row[SOIL_CODE]),
      source: metadata.soil.source,
      date: metadata.soil.date
    },
    topography: {
      source: metadata.topography.source,
      date: metadata.topography.date
    },
    elevation: {
      min: row[ELEVATION_MIN],
      mean: row[ELEVATION_MEAN],
      max: row[ELEVATION_MAX],
      mode: null
    },
    slope: {
      min: row[SLOPE_MIN],
      mode: row[SLOPE_MODE],
      max: row[SLOPE_MAX],
      mean: null
    },
    aspect: {
      label: aspect === 'ERROR' ? null : aspect,
      mean: null
    }
  }
}

/**
 * @param {{ metadata: object, lookups: Record<string, string[]>, rows: any[][] }} data
 * @returns {{ metadata: object, lookups: Record<string, string[]>, byBngRef: Map<string, any[]> }}
 */
export function indexGrids ({ metadata: rawMetadata, lookups, rows }) {
  const metadata = parseMetadata(rawMetadata)
  const byBngRef = new Map()
  for (const row of rows) {
    byBngRef.set(row[0], row)
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

    const data = await res.json()
    return indexGrids(data)
  } catch (err) {
    gridsPromise = null
    throw err
  }
}

/**
 * @param {string} bngRef
 * @returns {Promise<GridCell | null>}
 */
export async function getGridDetails (bngRef) {
  const { metadata, lookups, byBngRef } = await loadGrids()
  const row = byBngRef.get(bngRef)
  if (!row) {
    return null
  }
  return toGridCell(row, lookups, metadata)
}
