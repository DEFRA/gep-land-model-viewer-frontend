import { getJson } from '../data-layers/api.js'

/** @typedef {{ id: string, title: string, inspireTheme: string }} DatasetSummary */
/** @typedef {{ results: DatasetSummary[], total: number }} CatalogueResponse */
/**
 * @typedef {object} DatasetMetadata
 * @property {string} id
 * @property {string} title
 * @property {string} inspireTheme
 * @property {string} abstract
 * @property {string | null} owner
 * @property {string | null} accessLevel
 * @property {string | null} updateFrequency
 * @property {string[]} categories
 * @property {string | null} updatedAt
 * @property {string | null} licence
 * @property {string[]} format
 * @property {string | null} coordinateReferenceSystem
 * @property {string[]} places
 * @property {{ scaleDenominators: number[], distances: string[] } | null} resolution
 * @property {string | null} creationDate
 */

/**
 * @param {string} query
 * @param {AbortSignal} [signal]
 * @returns {Promise<CatalogueResponse>}
 */
export function loadCatalogue (query, signal) {
  const params = new URLSearchParams({ q: query })
  return getJson(`/api/datasets?${params}`, signal)
}

/** @param {string} id */
export function datasetLayerUrl (id) {
  return `/api/datasets/${encodeURIComponent(id)}/layer`
}

/** @returns {Promise<DatasetMetadata>} */
export function loadDatasetMetadata (id, signal) {
  return getJson(`/api/datasets/${encodeURIComponent(id)}`, signal)
}
