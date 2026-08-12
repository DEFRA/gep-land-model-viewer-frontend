import { datasets } from '../../config/datasets.js'
import { datasetForLayer } from '../../config/layers.js'
import { UNKNOWN_LAYER_LABEL } from './constants.js'

/**
 * Reads what sits under a pixel across the operational data layers: FlatGeobuf
 * features via hit detection and COG raster bands via a pixel read.
 * Returns groups of { label, values } per hit layer.
 */
export function valuesAt (map, pixel) {
  const groups = []

  map.forEachFeatureAtPixel(pixel, (feature, layer) => {
    // Overview tiles yield RenderFeatures, which have no named geometry property.
    const geometryName = feature.getGeometryName?.()
    groups.push({
      label: datasetForLayer(layer, datasets)?.label ?? UNKNOWN_LAYER_LABEL,
      values: Object.entries(feature.getProperties()).filter(([key]) => key !== geometryName)
    })
  }, { hitTolerance: 0, layerFilter: (layer) => datasetForLayer(layer, datasets)?.source.type === 'fgb' })

  for (const layer of map.getLayers().getArray()) {
    const dataset = datasetForLayer(layer, datasets)
    if (dataset?.source.type !== 'cog' || !layer.getVisible()) {
      continue
    }

    // The last band is the mask, so slice it off to get the values.
    const bands = layer.getData(pixel)
    if (bands?.at(-1)) {
      groups.push({
        label: dataset.label,
        values: Array.from(bands.slice(0, -1), (value, index) => [`band ${index + 1}`, value])
      })
    }
  }

  return groups
}
