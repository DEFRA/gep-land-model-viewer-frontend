import { toDate } from '../../../date.js'

/**
 * @typedef {object} LandModelRecord
 * @property {GridUnit | FeatureUnit} unit
 * @property {TaxonomyTheme | null} landCover
 * @property {TaxonomyTheme | null} landUse
 * @property {Ownership | null} ownership
 * @property {LandManagement | null} landManagement
 * @property {ProtectedAreas | null} protectedAreas
 * @property {TaxonomyTheme | null} soils
 */

/**
 * @typedef {object} GridUnit
 * @property {'grid'} kind
 * @property {string} bngRef Compact British National Grid reference
 * @property {import('./grid/resolution.js').GridCellSize} cellSize Metres
 */

/**
 * @typedef {object} FeatureUnit
 * @property {'feature'} kind
 * @property {string} osid
 * @property {string} [toid]
 */

/**
 * @typedef {object} TaxonomyTheme
 * @property {TaxonomyClass} dominant
 * @property {ClassIntersection[]} [intersections]
 * @property {Source} [source]
 * @typedef {{ code?: string, label: string }} TaxonomyClass
 * @typedef {{ label: string, percentage: number }} ClassIntersection
 */

/**
 * @typedef {{ percentage: number }} Intersection
 */

/**
 * @typedef {object} Ownership
 * @property {TitleRecord[]} titles
 * @property {ClassIntersection[]} [tenureIntersections]
 * @property {Source} [source]
 * @typedef {{ inspireId: string, titleDescriptor?: string, source?: Source }} TitleRecord
 */

/**
 * @typedef {object} LandManagement
 * @property {ManagementRecord[]} records
 * @property {Source} [source]
 * @typedef {{ pseudoSbi: string, refreshed?: Date, source?: Source }} ManagementRecord
 */

/**
 * @typedef {object} ProtectedAreas
 * @property {number} [count] Used when sites are not supplied
 * @property {ProtectedSite[]} [sites]
 * @property {Source} [source]
 * @typedef {{ code: string, name: string, designation: { code?: string, label: string },
 *   intersection: Intersection, source?: Source }} ProtectedSite
 */

/**
 * @typedef {{ name?: string, updated?: Date }} Source
 */

/**
 * @param {string} label
 * @param {string | null | undefined} code
 * @returns {TaxonomyClass}
 */
export function toTaxonomyClass (label, code) {
  return code == null ? { label } : { label, code }
}

/**
 * @param {string | null | undefined} name
 * @param {string | null | undefined} date dd/MM/yyyy
 * @returns {Source | undefined}
 */
export function toSource (name, date) {
  const updated = toDate(date)
  if (!name && !updated) {
    return undefined
  }

  return { ...(name ? { name } : {}), ...(updated ? { updated } : {}) }
}
