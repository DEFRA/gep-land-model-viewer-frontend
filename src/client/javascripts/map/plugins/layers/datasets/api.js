import { authenticatedFetch } from '../../../authenticated-fetch.js'
import { sourceFor } from './source.js'

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
 * @property {string[]} resolution
 * @property {string | null} creationDate
 */
/** @typedef {DatasetMetadata & { display: { styleConfig: { themes: object[] } | null, assets: { cog?: string, fgb?: string } } }} DatasetDetail */

async function getJson (url, signal) {
  const response = await authenticatedFetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Dataset request failed (${response.status})`)
  }

  return response.json()
}

/**
 * @param {string} query
 * @param {AbortSignal} [signal]
 * @returns {Promise<CatalogueResponse>}
 */
export function loadCatalogue (query, signal) {
  const params = new URLSearchParams({ q: query })
  return getJson(`/api/datasets?${params}`, signal)
}

/**
 * @param {string} id
 * @param {AbortSignal} [signal]
 * @returns {Promise<DatasetDetail>}
 */
function getDataset (id, signal) {
  return getJson(`/api/datasets/${encodeURIComponent(id)}`, signal)
}

/** @returns {Promise<{ id: string, source: import('./source.js').DatasetSource }>} */
export async function loadDataset (id, signal) {
  const { display } = await getDataset(id, signal)
  return { id, source: sourceFor(display.styleConfig, display.assets) }
}

/** @returns {Promise<DatasetMetadata>} */
export async function loadDatasetMetadata (id, signal) {
  const { display, ...metadata } = await getDataset(id, signal)
  return metadata
}
