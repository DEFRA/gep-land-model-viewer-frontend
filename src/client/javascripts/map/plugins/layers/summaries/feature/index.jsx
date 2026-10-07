import { OS_NGD_TILESET_URL, OS_NGD_STYLE_IDS } from '../../../../config/map-styles.js'
import { FEATURE_VISIBLE_MIN_ZOOM } from './constants.js'
import { createFeatureLayer } from './feature-layer.js'
import { getFeatureDetails } from './data.js'
import { LandSummaryView } from '../components/LandSummaryView.jsx'

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

    setZIndex (zIndex) {
      featureLayer.setZIndex(zIndex)
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

      /** @type {import('../model.js').FeatureUnit} */
      const unit = { kind: 'feature', osid: feature.osid }

      return [{
        label: 'OS feature',
        stillValid: isAvailable,
        select: () => featureLayer.selectFeature(unit.osid),
        loadDetails: (_options) => getFeatureDetails(unit.osid),
        render: details => <LandSummaryView record={details} unit={details?.unit ?? unit} outsideSampleArea={!details} />
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
