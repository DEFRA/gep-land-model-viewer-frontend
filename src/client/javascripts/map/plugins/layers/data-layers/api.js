import { authenticatedFetch } from '../../../authenticated-fetch.js'
import { sourceFor } from './source.js'

/**
 * @typedef {object} LayerResponse
 * @property {string | null} manifestVersion S3 version ID of manifest.json, null when unavailable
 * @property {string} generatedAt When the pipeline published the release
 * @property {{ themes: object[] }} styleConfig
 * @property {{ cog?: string, fgb?: string }} assets Asset URLs pinned to the release's file versions
 */

export async function getJson (url, signal) {
  const response = await authenticatedFetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`)
  }

  return response.json()
}

/**
 * @param {string} id
 * @param {string} url
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ id: string, source: import('./source.js').LayerSource }>}
 */
export async function loadLayer (id, url, signal) {
  /** @type {LayerResponse} */
  const { styleConfig, assets } = await getJson(url, signal)
  return { id, source: sourceFor(styleConfig, assets) }
}
