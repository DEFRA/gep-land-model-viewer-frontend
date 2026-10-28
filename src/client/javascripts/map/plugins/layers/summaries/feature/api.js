import { getJson } from '../../data-layers/api.js'
import { sourceFor } from '../../data-layers/source.js'

/**
 * @typedef {object} FeatureLayerResponse
 * @property {{ themes: object[], opacity?: number }} styleConfig
 * @property {{ fgb: string }} assets Asset URLs pinned to the release's file versions
 * @property {import('../land-model-properties.js').Sources} dataSources The release's data sources by theme
 */

/**
 * @typedef {import('../../data-layers/source.js').LayerSource & {
 *   dataSources: import('../land-model-properties.js').Sources
 * }} FeatureSource The OS features' map source, with the release's data sources
 */

/**
 * @param {string} id
 * @param {string} url
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ id: string, source: FeatureSource }>}
 */
export async function loadFeatureLayer (id, url, signal) {
  /** @type {FeatureLayerResponse} */
  const { styleConfig, assets, dataSources } = await getJson(url, signal)
  return { id, source: { ...sourceFor(styleConfig, assets), dataSources } }
}
