import { manifest } from './manifest.js'

/**
 * @param {Record<string, unknown>} [options]
 * @returns {Record<string, unknown> & { id: string, load: () => Promise<typeof manifest> }}
 */
function createInfoLinksPlugin (options = {}) {
  return {
    ...options,
    id: 'gepInfoLinks',
    load: async () => manifest
  }
}

export { createInfoLinksPlugin }
export default createInfoLinksPlugin
