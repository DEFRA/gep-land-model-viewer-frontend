import { manifest } from './manifest.js'

/**
 * @param {Record<string, unknown>} [options]
 * @returns {Record<string, unknown> & { id: string, load: () => Promise<typeof manifest> }}
 */
function createNorthIndicatorPlugin (options = {}) {
  return {
    ...options,
    id: 'gepNorthIndicator',
    load: async () => manifest
  }
}

export { createNorthIndicatorPlugin }
export default createNorthIndicatorPlugin
