import { manifest } from './manifest.js'

/**
 * @typedef {Record<string, unknown> & {
 *   datasets?: Array<object>
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
