import { toSource } from './model.js'

/**
 * A parcel or grid cell land model properties.
 *
 * The 10m grid cells only include dominant values, id and counts.
 *
 * Parcels and coarse grid cells have each intersections for each theme,
 * except for the coarse grids protected area which is a count the same as the 10m grid.
 *
 * @typedef {object} LandModelProperties
 * @property {string | null} [land_cover_dominant_value]
 * @property {string | null} [land_cover_intersections_json]
 * @property {string | null} [land_use_dominant_value]
 * @property {string | null} [land_use_intersections_json]
 * @property {string | null} [soil_dominant_value]
 * @property {string | null} [soil_intersections_json]
 * @property {number | null} [land_management_dominant_id]
 * @property {string | null} [land_management_intersections_json]
 * @property {number | null} [protected_area_count]
 * @property {string | null} [protected_area_intersections_json]
 * @property {number | null} [ownership_dominant_id]
 * @property {string | null} [ownership_dominant_value]
 * @property {string | null} [ownership_intersections_json]
 */

/**
 * @typedef {{ name?: string, date?: string | null }} SourceDescription
 * @typedef {Record<string, SourceDescription>} Sources
 */

/**
 * @typedef {{ mapped_value: string, intersection_area: number, intersection_pct: number }} ClassIntersection
 * @typedef {{ id: string | number | null, intersection_area: number, intersection_pct: number }} ManagementIntersection
 * @typedef {{ id: number, mapped_value?: string, intersection_area: number, intersection_pct: number }} OwnershipIntersection
 * @typedef {{ code: string, type: string, name: string, intersection_area: number, intersection_pct: number }} ProtectedAreaIntersection
 */

/**
 * @param {string | null | undefined} value
 * @returns {any[]}
 */
function parseIntersections (value) {
  return value == null ? [] : JSON.parse(value)
}

/**
 * @param {SourceDescription | undefined} description
 * @returns {{ source?: import('./model.js').Source }}
 */
function sourceOf (description) {
  const source = toSource(description?.name, description?.date)
  return source ? { source } : {}
}

/**
 * @param {ClassIntersection[]} intersections
 * @returns {ClassIntersection | undefined}
 */
function largestIntersection (intersections) {
  let largest = intersections[0]
  for (const intersection of intersections) {
    if (intersection.intersection_pct > largest.intersection_pct) {
      largest = intersection
    }
  }

  return largest
}

/**
 * @param {ClassIntersection} intersection
 * @returns {import('./model.js').ClassIntersection}
 */
function toClassIntersection (intersection) {
  return { label: intersection.mapped_value, percentage: intersection.intersection_pct, area: intersection.intersection_area }
}

/**
 * Ownership has one intersection per title rather than per tenure, so titles with the same tenure are added up into one share.
 *
 * @param {OwnershipIntersection[]} intersections
 * @returns {import('./model.js').ClassIntersection[]}
 */
function toTenureIntersections (intersections) {
  const tenures = new Map()
  for (const { mapped_value: label, intersection_area: area, intersection_pct: percentage } of intersections) {
    if (!label) {
      continue
    }

    const tenure = tenures.get(label) ?? { label, area: 0, percentage: 0 }
    tenures.set(label, { label, area: tenure.area + area, percentage: tenure.percentage + percentage })
  }

  return [...tenures.values()].map(tenure => ({ ...tenure, percentage: Math.round(tenure.percentage * 10) / 10 }))
}

/**
 * @param {string | null | undefined} dominantValue
 * @param {string | null | undefined} value The theme's intersections
 * @param {SourceDescription} [description] The theme's source
 * @returns {import('./model.js').TaxonomyTheme | null}
 */
function toTaxonomyTheme (dominantValue, value, description) {
  /** @type {ClassIntersection[]} */
  const intersections = parseIntersections(value)
  // coarse grid cells only have intersections, so take the largest
  const dominant = dominantValue ?? largestIntersection(intersections)?.mapped_value
  if (!dominant) {
    return null
  }

  return {
    dominant: { label: dominant },
    ...(intersections.length ? { intersections: intersections.map(toClassIntersection) } : {}),
    ...sourceOf(description)
  }
}

/**
 * @param {LandModelProperties} properties
 * @param {SourceDescription} [description]
 * @returns {import('./model.js').Ownership | null}
 */
function toOwnership (properties, description) {
  if (properties.ownership_dominant_id !== undefined) {
    const inspireId = properties.ownership_dominant_id
    const titleDescriptor = properties.ownership_dominant_value
    return { titles: inspireId ? [{ inspireId: String(inspireId), ...(titleDescriptor ? { titleDescriptor } : {}) }] : [], ...sourceOf(description) }
  }

  if (properties.ownership_intersections_json == null) {
    return null
  }

  /** @type {OwnershipIntersection[]} */
  const intersections = parseIntersections(properties.ownership_intersections_json)
  return {
    titles: intersections.map(intersection => ({
      inspireId: String(intersection.id),
      area: intersection.intersection_area,
      ...(intersection.mapped_value ? { titleDescriptor: intersection.mapped_value } : {})
    })),
    tenureIntersections: toTenureIntersections(intersections),
    ...sourceOf(description)
  }
}

/**
 * @param {LandModelProperties} properties
 * @param {SourceDescription} [description]
 * @returns {import('./model.js').LandManagement | null}
 */
function toLandManagement (properties, description) {
  if (properties.land_management_dominant_id !== undefined) {
    const pseudoSbi = properties.land_management_dominant_id
    return { records: pseudoSbi ? [{ pseudoSbi: String(pseudoSbi) }] : [], ...sourceOf(description) }
  }

  if (properties.land_management_intersections_json == null) {
    return null
  }

  /** @type {ManagementIntersection[]} */
  const intersections = parseIntersections(properties.land_management_intersections_json)
  const records = intersections
    .filter(intersection => intersection.id != null && intersection.id !== 'null')
    .map(intersection => ({ pseudoSbi: String(intersection.id) }))
  return { records, ...sourceOf(description) }
}

/**
 * @param {LandModelProperties} properties
 * @param {SourceDescription} [description]
 * @returns {import('./model.js').ProtectedAreas | null}
 */
function toProtectedAreas (properties, description) {
  if (properties.protected_area_count !== undefined) {
    return { count: properties.protected_area_count, ...sourceOf(description) }
  }

  if (properties.protected_area_intersections_json == null) {
    return null
  }

  /** @type {ProtectedAreaIntersection[]} */
  const intersections = parseIntersections(properties.protected_area_intersections_json)
  return {
    sites: intersections.map(intersection => ({
      code: intersection.code,
      name: intersection.name,
      designation: { label: intersection.type },
      intersection: { percentage: intersection.intersection_pct }
    })),
    ...sourceOf(description)
  }
}

/**
 * @param {import('./model.js').GridUnit | import('./model.js').FeatureUnit} unit
 * @param {LandModelProperties} properties
 * @param {Sources} [sources]
 * @returns {import('./model.js').LandModelRecord}
 */
export function toLandModelRecord (unit, properties, sources = {}) {
  return {
    unit,
    landCover: toTaxonomyTheme(properties.land_cover_dominant_value, properties.land_cover_intersections_json, sources.land_cover),
    landUse: toTaxonomyTheme(properties.land_use_dominant_value, properties.land_use_intersections_json, sources.land_use),
    ownership: toOwnership(properties, sources.ownership),
    landManagement: toLandManagement(properties, sources.land_management),
    protectedAreas: toProtectedAreas(properties, sources.protected_area),
    soils: toTaxonomyTheme(properties.soil_dominant_value, properties.soil_intersections_json, sources.soil)
  }
}
