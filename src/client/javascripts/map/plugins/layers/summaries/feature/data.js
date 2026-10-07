import { authenticatedFetch } from '../../../../authenticated-fetch.js'
import { toTaxonomyClass, toSource } from '../model.js'

const PARCELS_URL = '/land-model/parcels.json'

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
 */

/** @type {Promise<Map<string, import('../model.js').LandModelRecord>> | null} */
let featuresPromise = null

/** @returns {import('../model.js').TaxonomyTheme | null} */
function toTaxonomyTheme (intersecting, label, code, sourceName, date) {
  if (label == null) {
    return null
  }

  const source = toSource(sourceName, date)

  return {
    dominant: toTaxonomyClass(label, code),
    ...(intersecting == null ? {} : { intersections: Object.entries(intersecting).map(([name, percentage]) => ({ label: name, percentage })) }),
    ...(source ? { source } : {})
  }
}

/**
 * @param {RawParcel} raw
 * @returns {import('../model.js').LandModelRecord}
 */
export function toFeatureRecord (raw) {
  return {
    unit: { kind: 'feature', osid: raw.osid, toid: raw.toid },
    landCover: toTaxonomyTheme(raw.land_cover_intersecting, raw.dominant_land_cover_model_display_text, raw.dominant_land_cover_code, raw.land_cover_source, raw.land_cover_date),
    landUse: toTaxonomyTheme(null, raw.land_use_model_display_text, raw.land_use_model_code),
    ownership: null,
    landManagement: null,
    protectedAreas: null,
    soils: toTaxonomyTheme(raw.soil_intersecting, raw.dominant_soil_model_display_text, raw.dominant_soil_code, raw.soil_source, raw.soil_date)
  }
}

/**
 * @param {RawParcel[]} rows
 * @returns {Map<string, import('../model.js').LandModelRecord>}
 */
export function indexFeatures (rows) {
  const byOsid = new Map()
  for (const raw of rows) {
    byOsid.set(raw.osid, toFeatureRecord(raw))
  }
  return byOsid
}

function loadFeatures () {
  featuresPromise ??= fetchFeatures()
  return featuresPromise
}

async function fetchFeatures () {
  try {
    const res = await authenticatedFetch(PARCELS_URL)
    if (!res.ok) {
      throw new Error(`Failed to load parcels (${res.status})`)
    }

    return indexFeatures(await res.json())
  } catch (err) {
    featuresPromise = null
    throw err
  }
}

/**
 * @param {string} osid
 * @returns {Promise<import('../model.js').LandModelRecord | null>}
 */
export async function getFeatureDetails (osid) {
  const byOsid = await loadFeatures()
  return byOsid.get(osid) ?? null
}
