import { config } from '../../config/config.js'

export const mapController = {
  handler (_request, h) {
    return h.view('map/index', {
      pageTitle: 'Map',
      findGeoDataUrl: config.get('findGeoDataUrl')
    })
  }
}
