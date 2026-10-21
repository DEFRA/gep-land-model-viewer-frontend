import gridRoutes from './grid-routes.js'
import parcelRoutes from './parcel-routes.js'

export const landModel = {
  plugin: {
    name: 'land-model',
    register (server) {
      server.route(gridRoutes)
      server.route(parcelRoutes)
    }
  }
}
