import { mapController } from './controller.js'
import { styleRoutes } from './style.js'
import { mapContentSecurityPolicy } from '../common/helpers/content-security-policy.js'

export const map = {
  plugin: {
    name: 'map',
    register (server) {
      server.route([
        {
          method: 'GET',
          path: '/map',
          ...mapController,
          options: {
            plugins: { blankie: mapContentSecurityPolicy }
          }
        },
        ...styleRoutes
      ])
    }
  }
}
