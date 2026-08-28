import { OS_NGD_TILESET_URL, OS_NGD_STYLE_IDS } from '../../../../config/map-styles.js'
import { FEATURE_VISIBLE_MIN_ZOOM } from './constants.js'
import { createFeatureLayer } from './feature-layer.js'
import { getFeatureDetails } from './data.js'
import { FeatureInfo } from './FeatureInfo.jsx'

/**
 * @param {import('ol/Map').default} map
 */
export function createFeatureSummary (map) {
  const featureLayer = createFeatureLayer(map, OS_NGD_TILESET_URL)
  const view = map.getView()
  let visible = false

  const isAvailable = () => visible && view.getZoom() >= FEATURE_VISIBLE_MIN_ZOOM

  return {
    setVisible (next) {
      visible = next
      featureLayer.setEnabled(next)
    },

    getHits (coords) {
      if (!isAvailable()) {
        return []
      }

      const pixel = map.getPixelFromCoordinate(coords)
      const feature = featureLayer.findFeatureAtPixel(pixel)
      if (!feature) {
        return []
      }

      return [{
        label: 'OS feature',
        stillValid: isAvailable,
        select: () => featureLayer.selectFeature(feature.osid),
        loadDetails: (_options) => getFeatureDetails(feature.osid),
        render: details => <FeatureInfo hit={feature} details={details} />
      }]
    },

    clearSelection () {
      featureLayer.clearSelection()
    },

    /** A style change replaces the basemap layer the features are read from. */
    setMapStyle (mapStyleId) {
      featureLayer.refreshSource(OS_NGD_STYLE_IDS.includes(mapStyleId))
    },

    dispose () {
      featureLayer.clearSelection()
      featureLayer.dispose()
    }
  }
}
