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
 * @property {{ scaleDenominators: number[], distances: string[] } | null} resolution
 * @property {string | null} creationDate
 */
/**
 * @typedef {object} DatasetLayer
 * @property {string | null} manifestVersion S3 version ID of manifest.json, null when unavailable
 * @property {string} generatedAt When the pipeline published the release
 * @property {{ themes: object[] }} styleConfig
 * @property {{ cog?: string, fgb?: string }} assets Asset URLs pinned to the release's file versions
 */

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

/** @returns {Promise<{ id: string, source: import('./source.js').DatasetSource }>} */
export async function loadDataset (id, signal) {
  /** @type {DatasetLayer} */
  const { styleConfig, assets } = await getJson(`/api/datasets/${encodeURIComponent(id)}/layer`, signal)
  return { id, source: sourceFor(styleConfig, assets) }
}

/** @returns {Promise<DatasetMetadata>} */
export function loadDatasetMetadata (id, signal) {
  return getJson(`/api/datasets/${encodeURIComponent(id)}`, signal)
}
