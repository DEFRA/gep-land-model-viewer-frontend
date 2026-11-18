import Feature from 'ol/Feature.js'
import VectorLayer from 'ol/layer/Vector.js'
import VectorSource from 'ol/source/Vector.js'
import Style from 'ol/style/Style.js'
import Stroke from 'ol/style/Stroke.js'
import { SELECTION_Z_INDEX } from '../../../config/layers.js'
import { DEFRA_GREEN_DARK } from '../../../config/colours.js'

const OUTLINE_STYLE = new Style({
  stroke: new Stroke({ color: DEFRA_GREEN_DARK, width: 2, lineDash: [8, 6] })
})

/**
 * Shows the polygon that selected an area, above the selected units' highlights.
 *
 * @param {import('ol/Map').default} map
 */
export function createOutline (map) {
  const source = new VectorSource()
  const layer = new VectorLayer({
    source,
    style: OUTLINE_STYLE,
    zIndex: SELECTION_Z_INDEX + 1,
    properties: { id: 'gep-layer-outline' }
  })
  map.addLayer(layer)

  return {
    /** @param {import('ol/geom/Polygon').default} polygon */
    show (polygon) {
      source.clear()
      source.addFeature(new Feature(polygon))
    },

    clear () {
      source.clear()
    },

    dispose () {
      source.clear()
      map.removeLayer(layer)
    }
  }
}
