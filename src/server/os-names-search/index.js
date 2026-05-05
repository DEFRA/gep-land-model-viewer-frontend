import { config } from '../../config/config.js'
import { createLogger } from '../common/helpers/logging/logger.js'
import routes from './routes.js'

const logger = createLogger()

export const osNamesSearch = {
  plugin: {
    name: 'os-names-search',
    register (server) {
      const osApiKey = config.get('map.osApiKey')
      if (!osApiKey) {
        logger.warn('OS_API_KEY is not set; OS Names search proxy requests will fail')
      }

      server.route(routes)
    }
  }
}
