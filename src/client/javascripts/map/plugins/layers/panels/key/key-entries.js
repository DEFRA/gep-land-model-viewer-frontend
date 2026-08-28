import { datasetForLayer } from '../../../../config/layers.js'
import { UNKNOWN_LAYER_LABEL } from '../../constants.js'
import { getSourceUrl, getVisibleWmsLayers } from '../../datasets/layers/wms.js'

export function getKeyEntries (map, datasets) {
  return getVisibleWmsLayers(map).map(layer => {
    const dataset = datasetForLayer(layer, datasets)
    const label = dataset?.label ?? UNKNOWN_LAYER_LABEL
    const source = layer.getSource()
    const layerNames = source.getParams().LAYERS
    const baseUrl = getSourceUrl(source)
    if (!layerNames || !baseUrl) {
      return null
    }
    return { label, baseUrl, layerNames: layerNames.split(',') }
  }).filter(Boolean)
}
