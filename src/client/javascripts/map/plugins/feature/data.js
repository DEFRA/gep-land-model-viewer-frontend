import { toDate } from '../info-panel/render.js'

const PARCELS_URL = '/land-model/parcels.json'

const TOPOGRAPHY_DATE = new Date(2023, 2, 8)
const TOPOGRAPHY_DATA_SOURCE = 'LIDAR Composite Digital Terrain Model (DTM) 1m'

/**
 * @typedef {object} RawParcel
 * @property {string} osid
 * @property {string} toid
 * @property {string | null} land_use_model_code
 * @property {string | null} land_use_model_display_text
 * @property {Record<string, number>} land_cover_intersecting
 * @property {string} dominant_land_cover_model_display_text
 * @property {string} dominant_land_cover_code
 * @property {string} land_cover_source
 * @property {string} land_cover_date
 * @property {Record<string, number>} soil_intersecting
 * @property {string} dominant_soil_model_display_text
 * @property {string} dominant_soil_code
 * @property {string} soil_source
 * @property {string} soil_date
 * @property {number | null} elevation_min
 * @property {number | null} elevation_mean
 * @property {number | null} elevation_mode
 * @property {number | null} elevation_max
 * @property {number | null} slope_min
 * @property {number | null} slope_mean
 * @property {number | null} slope_mode
 * @property {number | null} slope_max
 * @property {number | null} aspect_mean
 * @property {string | null} aspect_aspect
 */

/**
 * @typedef {object} Breakdown
 * @property {string} label
 * @property {number} percentage
 */

/**
 * @typedef {object} Parcel
 * @property {string} osid
 * @property {string} toid
 * @property {object} landUse
 * @property {string | null} landUse.label
 * @property {string | null} landUse.code
 * @property {object} landCover
 * @property {string} landCover.dominantLabel
 * @property {string} landCover.dominantCode
 * @property {boolean} landCover.isMixed
 * @property {Breakdown[]} landCover.breakdown
 * @property {string} landCover.source
 * @property {Date | null} landCover.date
 * @property {object} soil
 * @property {string} soil.dominantLabel
 * @property {string} soil.dominantCode
 * @property {boolean} soil.isMixed
 * @property {Breakdown[]} soil.breakdown
 * @property {string} soil.source
 * @property {Date | null} soil.date
 * @property {object} topography
 * @property {string} topography.source
 * @property {Date} topography.date
 * @property {object} elevation
 * @property {number | null} elevation.min
 * @property {number | null} elevation.mean
 * @property {number | null} elevation.mode
 * @property {number | null} elevation.max
 * @property {object} slope
 * @property {number | null} slope.min
 * @property {number | null} slope.mean
 * @property {number | null} slope.mode
 * @property {number | null} slope.max
 * @property {object} aspect
 * @property {number | null} aspect.mean
 * @property {string | null} aspect.label
 */

/** @type {Promise<Map<string, Parcel>> | null} */
let parcelsPromise = null

/**
 * @param {Record<string, number> | null} intersecting
 * @returns {Breakdown[]}
 */
function toBreakdown (intersecting) {
  return Object.entries(intersecting ?? {})
    .map(([label, percentage]) => ({ label, percentage }))
    .sort((a, b) => b.percentage - a.percentage)
}

/**
 * @param {RawParcel} raw
 * @returns {Parcel}
 */
export function toParcel (raw) {
  return {
    osid: raw.osid,
    toid: raw.toid,
    landUse: {
      label: raw.land_use_model_display_text,
      code: raw.land_use_model_code
    },
    landCover: {
      dominantLabel: raw.dominant_land_cover_model_display_text,
      dominantCode: raw.dominant_land_cover_code,
      isMixed: Object.keys(raw.land_cover_intersecting ?? {}).length > 1,
      breakdown: toBreakdown(raw.land_cover_intersecting),
      source: raw.land_cover_source,
      date: toDate(raw.land_cover_date)
    },
    soil: {
      dominantLabel: raw.dominant_soil_model_display_text,
      dominantCode: raw.dominant_soil_code,
      isMixed: Object.keys(raw.soil_intersecting ?? {}).length > 1,
      breakdown: toBreakdown(raw.soil_intersecting),
      source: raw.soil_source,
      date: toDate(raw.soil_date)
    },
    topography: {
      source: TOPOGRAPHY_DATA_SOURCE,
      date: TOPOGRAPHY_DATE
    },
    elevation: {
      min: raw.elevation_min,
      mean: raw.elevation_mean,
      mode: raw.elevation_mode,
      max: raw.elevation_max
    },
    slope: {
      min: raw.slope_min,
      mean: raw.slope_mean,
      mode: raw.slope_mode,
      max: raw.slope_max
    },
    aspect: {
      mean: raw.aspect_mean,
      label: raw.aspect_aspect === 'ERROR' ? null : raw.aspect_aspect
    }
  }
}

/**
 * @param {RawParcel[]} rows
 * @returns {Map<string, Parcel>}
 */
export function indexParcels (rows) {
  const byOsid = new Map()
  for (const raw of rows) {
    byOsid.set(raw.osid, toParcel(raw))
  }
  return byOsid
}

/**
 * @returns {Promise<Map<string, Parcel>>}
 */
function loadParcels () {
  parcelsPromise ??= fetchParcels()
  return parcelsPromise
}

async function fetchParcels () {
  try {
    const res = await fetch(PARCELS_URL)
    if (!res.ok) {
      throw new Error(`Failed to load parcels (${res.status})`)
    }

    const rows = await res.json()
    return indexParcels(rows)
  } catch (err) {
    parcelsPromise = null
    throw err
  }
}

/**
 * @param {string} osid
 * @returns {Promise<Parcel | null>}
 */
export async function getFeatureDetails (osid) {
  const byOsid = await loadParcels()
  return byOsid.get(osid) ?? null
}
