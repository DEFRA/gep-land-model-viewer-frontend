import wmsRoutes from './wms-routes.js'

export const wmsProxy = {
  plugin: {
    name: 'wms-proxy',
    register (server) {
      server.route(wmsRoutes)
    }
  }
}
