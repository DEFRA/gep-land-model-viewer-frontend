import { config } from '../../config/config.js'
import { createLayerRoutes } from '../common/helpers/s3/layer-routes.js'

export default createLayerRoutes({
  path: '/api/land-model/parcels/layer',
  prefixFor: () => 'land-model/parcels',
  assetFiles: { fgb: 'data.fgb' },
  minZoom: config.get('map.featuresMinZoom'),
  name: 'Parcels',
  service: 'Land model'
})
