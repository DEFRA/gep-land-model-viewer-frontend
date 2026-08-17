import VectorTileLayer from 'ol/layer/VectorTile.js'
import OGCVectorTile from 'ol/source/OGCVectorTile.js'
import MVT from 'ol/format/MVT.js'
import Style from 'ol/style/Style.js'
import Fill from 'ol/style/Fill.js'
import Stroke from 'ol/style/Stroke.js'
import { getBasemapLayer } from '../../basemap.js'
import { FEATURE_SOURCE_LAYER, FEATURE_VISIBLE_MIN_ZOOM, MVT_LAYER_PROPERTY } from './constants.js'
import { DEFRA_GREEN, DEFRA_GREEN_DARK, withAlpha } from '../../config/colours.js'
import { OVERLAY_Z_INDEX } from '../../config/layers.js'

const HIT_DETECTION_FILL_COLOUR = 'rgba(0, 0, 0, 0.01)' // Near-transparent so parcel interiors register clicks

const OUTLINE_STYLE = new Style({
  fill: new Fill({ color: HIT_DETECTION_FILL_COLOUR }),
  stroke: new Stroke({ color: withAlpha(DEFRA_GREEN_DARK, 0.6), width: 1.5 })
})

const SELECTED_STYLE = new Style({
  fill: new Fill({ color: withAlpha(DEFRA_GREEN, 0.25) }),
  stroke: new Stroke({ color: DEFRA_GREEN_DARK, width: 2 })
})

function createDedicatedSource (tilesetUrl) {
  const format = new MVT()
  format.supportedMediaTypes.push('application/octet-stream')

  return new OGCVectorTile({ url: tilesetUrl, format, projection: 'EPSG:27700' })
}

export function createFeatureLayer (map, tilesetUrl) {
  let dedicatedSource = null
  let selectedOsid = null

  function styleFn (feature) {
    if (feature.get(MVT_LAYER_PROPERTY) !== FEATURE_SOURCE_LAYER) {
      return undefined
    }
    if (feature.get('osid') === selectedOsid) {
      return SELECTED_STYLE
    }
    return OUTLINE_STYLE
  }

  const overlayLayer = new VectorTileLayer({
    style: styleFn,
    renderMode: 'vector',
    visible: false,
    // OL's minZoom is exclusive, so step back one from the first zoom that draws.
    minZoom: FEATURE_VISIBLE_MIN_ZOOM - 1,
    zIndex: OVERLAY_Z_INDEX,
    properties: { id: 'gep-feature-overlay' }
  })

  /**
   * Sharing the basemap source avoids fetching and decoding the same tiles twice.
   * @param {boolean} shareBasemapSource Whether the active style's basemap serves the feature tileset.
   */
  function refreshSource (shareBasemapSource) {
    let next
    if (shareBasemapSource) {
      next = getBasemapLayer(map).getSource()
    } else {
      dedicatedSource ??= createDedicatedSource(tilesetUrl)
      next = dedicatedSource
    }
    overlayLayer.setSource(next)
  }

  map.addLayer(overlayLayer)

  return {
    refreshSource,

    selectFeature (osid) {
      selectedOsid = osid
      overlayLayer.changed()
    },

    clearSelection () {
      selectedOsid = null
      overlayLayer.changed()
    },

    setEnabled (next) {
      overlayLayer.setVisible(next)
      if (!next) {
        selectedOsid = null
      }
    },

    findFeatureAtPixel (pixel) {
      let found = null
      map.forEachFeatureAtPixel(pixel, (feature) => {
        if (feature.get(MVT_LAYER_PROPERTY) !== FEATURE_SOURCE_LAYER) {
          return false
        }

        const osid = feature.get('osid')
        if (osid) {
          found = { osid, description: feature.get('description') }
          return true
        }
        return false
      }, { layerFilter: (l) => l === overlayLayer })
      return found
    }
  }
}
