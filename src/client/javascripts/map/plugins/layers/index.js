import { manifest } from './manifest.js'

/**
 * @typedef {Record<string, unknown> & {
 *   datasets?: Array<object>
 *   styleNonce?: string
 * }} LayersPluginOptions
 */

/**
 * @param {LayersPluginOptions} [options]
 */
export default function createPlugin ({ datasets = [], ...options } = {}) {
  return {
    ...options,
    datasets,
    id: 'gepLayers',
    load: async () => manifest
  }
}
