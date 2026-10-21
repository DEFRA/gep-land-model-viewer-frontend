import { createLayerRoutes } from '../common/helpers/s3/layer-routes.js'

export default createLayerRoutes({
  path: '/api/land-model/grid/layer',
  prefixFor: () => 'land-model/grid',
  assetFiles: {
    cog: '10.tif',
    fgbs: { 100: '100.fgb', 1000: '1000.fgb', 10000: '10000.fgb', 100000: '100000.fgb' }
  },
  jsonFiles: { bands: 'bands.json' },
  name: 'Grid',
  service: 'Land model'
})
