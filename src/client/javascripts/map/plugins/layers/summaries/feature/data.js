import { toTaxonomyClass, toSource } from '../model.js'

/**
 * @typedef {object} ParcelProperties
 * @property {string} osid
 * @property {string} toid
 * @property {string} [land_cover_dom_code]
 * @property {string} [land_cover_dom_name]
 * @property {string} [land_cover_proportions] Percentages by label, as JSON text
 * @property {string} [land_cover_source]
 * @property {string} [land_cover_date]
 * @property {string} [land_use_dom_code]
 * @property {string} [land_use_dom_name]
 * @property {string} [land_use_source]
 * @property {string} [land_use_date]
 * @property {string} [soil_dom_code]
 * @property {string} [soil_dom_name]
 * @property {string} [soil_proportions]
 * @property {string} [soil_source]
 * @property {string} [soil_date]
 */

/**
 * @param {string | undefined} value
 * @returns {Record<string, number> | null}
 */
function parseProportions (value) {
  return value == null ? null : JSON.parse(value)
}

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
 * @param {ParcelProperties} properties
 * @returns {import('../model.js').LandModelRecord}
 */
export function toFeatureRecord (properties) {
  return {
    unit: { kind: 'feature', osid: properties.osid, toid: properties.toid },
    landCover: toTaxonomyTheme(parseProportions(properties.land_cover_proportions), properties.land_cover_dom_name, properties.land_cover_dom_code, properties.land_cover_source, properties.land_cover_date),
    landUse: toTaxonomyTheme(null, properties.land_use_dom_name, properties.land_use_dom_code, properties.land_use_source, properties.land_use_date),
    ownership: null,
    landManagement: null,
    protectedAreas: null,
    soils: toTaxonomyTheme(parseProportions(properties.soil_proportions), properties.soil_dom_name, properties.soil_dom_code, properties.soil_source, properties.soil_date)
  }
}
