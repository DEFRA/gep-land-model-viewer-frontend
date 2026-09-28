import datasetRoutes from './dataset-routes.js'

export const datasets = {
  plugin: {
    name: 'datasets',
    register (server) {
      server.route(datasetRoutes)
    }
  }
}
