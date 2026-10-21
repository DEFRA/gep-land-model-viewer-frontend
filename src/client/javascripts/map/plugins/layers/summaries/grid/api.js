import { getJson } from '../../data-layers/api.js'
import { sourceFor } from '../../data-layers/source.js'

/**
 * @typedef {object} GridLayerResponse
 * @property {{ themes: object[], opacity?: number }} styleConfig
 * @property {{ cog: string, fgbs: Record<string, string> }} assets Asset URLs pinned to the release's file versions
 * @property {import('./data.js').Bands} bands
 */

/**
 * @typedef {import('../../data-layers/source.js').LayerSource & {
 *   bands: import('./data.js').Bands,
 *   fgbs: Record<string, string>
 * }} GridSource The grid's map source, with its band descriptions and coarse grid FGB URLs by cell size
 */

/**
 * @param {string} id
 * @param {string} url
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ id: string, source: GridSource }>}
 */
export async function loadGridLayer (id, url, signal) {
  /** @type {GridLayerResponse} */
  const { styleConfig, assets, bands } = await getJson(url, signal)
  return { id, source: { ...sourceFor(styleConfig, assets), bands, fgbs: assets.fgbs } }
}
