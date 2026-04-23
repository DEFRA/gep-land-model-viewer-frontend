// Adapted from DEFRA/nrf-frontend os-base-map proxy

import { config } from '../../config/config.js'
import { createLogger } from '../common/helpers/logging/logger.js'
import routes from './routes.js'

const logger = createLogger()

/**
 * Serves Ordnance Survey base map resources (vector tiles, sprites, and style metadata).
 * Proxies requests to api.os.uk, injecting the OS API key server-side.
 */
export const osBaseMap = {
  plugin: {
    name: 'os-base-map',
    register (server) {
      const osApiKey = config.get('map.osApiKey')
      if (!osApiKey) {
        logger.warn('OS_API_KEY is not set; map proxy requests will fail')
      }

      server.route(routes)
    }
  }
}
