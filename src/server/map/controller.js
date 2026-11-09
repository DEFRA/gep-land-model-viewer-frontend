import { config } from '../../config/config.js'

export const mapController = {
  handler (_request, h) {
    return h.view('map/index', {
      pageTitle: 'Map',
      findGeoDataUrl: config.get('findGeoDataUrl'),
      mapCenter: [config.get('map.center.easting'), config.get('map.center.northing')],
      mapZoom: config.get('map.zoom')
    })
  }
}
