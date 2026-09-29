import { manifest } from './manifest.js'

/**
 * @typedef {Record<string, unknown> & {
 *   styleNonce?: string
 *   findGeoDataUrl?: string
 *   datasetId?: string | null
 * }} LayersPluginOptions
 */

/**
 * @param {LayersPluginOptions} [options]
 */
export default function createPlugin (options = {}) {
  return {
    ...options,
    id: 'gepLayers',
    load: async () => manifest
  }
}
