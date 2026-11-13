import Feature from 'ol/Feature.js'
import Point from 'ol/geom/Point.js'
import VectorLayer from 'ol/layer/Vector.js'
import VectorSource from 'ol/source/Vector.js'
import Style from 'ol/style/Style.js'
import Fill from 'ol/style/Fill.js'
import RegularShape from 'ol/style/RegularShape.js'
import Stroke from 'ol/style/Stroke.js'
import { SELECTION_Z_INDEX } from '../../../config/layers.js'
import { DEFRA_GREEN, DEFRA_GREEN_DARK, withAlpha } from '../../../config/colours.js'

const HIGHLIGHT_STYLE = new Style({
  fill: new Fill({ color: withAlpha(DEFRA_GREEN, 0.25) }),
  stroke: new Stroke({ color: DEFRA_GREEN_DARK, width: 2 })
})

const CROSSHAIR_STYLE = new Style({
  image: new RegularShape({
    points: 4,
    radius: 11,
    radius2: 0,
    stroke: new Stroke({ color: DEFRA_GREEN_DARK, width: 2 })
  })
})

export function createHighlight (map) {
  const source = new VectorSource()
  const layer = new VectorLayer({
    source,
    style: HIGHLIGHT_STYLE,
    zIndex: SELECTION_Z_INDEX,
    properties: { id: 'gep-layer-highlight' }
  })
  map.addLayer(layer)

  function clearFeatures () {
    const features = source.getFeatures()
    source.clear()
    // Each feature listens to its geometry, which can outlive the highlight
    for (const feature of features) {
      feature.setGeometry(undefined)
    }
  }

  return {
    show (geometries) {
      clearFeatures()
      for (const geometry of geometries) {
        if (geometry) {
          source.addFeature(new Feature(geometry))
        }
      }
    },

    showPoint (coords) {
      clearFeatures()
      const feature = new Feature(new Point(coords))
      feature.setStyle(CROSSHAIR_STYLE)
      source.addFeature(feature)
    },

    clear () {
      clearFeatures()
    },

    dispose () {
      clearFeatures()
      map.removeLayer(layer)
    }
  }
}
