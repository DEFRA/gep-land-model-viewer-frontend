import { createLogger } from '../common/helpers/logging/logger.js'
import { getApiKey } from './config.js'
import mapRoutes from './map-routes.js'
import namesRoutes from './names-routes.js'

const logger = createLogger()

export const osProxy = {
  plugin: {
    name: 'os-proxy',
    register (server) {
      if (!getApiKey()) {
        logger.warn('OS_API_KEY is not set; OS proxy requests will fail')
      }

      server.route([...mapRoutes, ...namesRoutes])
    }
  }
}
