import { datasetForLayer } from '../../../config/layers.js'

/** Builds the attribution for the basemap and visible datasets. */
export function getAttribution (map, datasets, baseAttribution) {
  const visibleAttributions = map.getLayers().getArray()
    .filter(layer => layer.getVisible() && layer.get('id'))
    .map(layer => datasetForLayer(layer, datasets)?.source.attribution)
    .filter(Boolean)

  return [...new Set([baseAttribution, ...visibleAttributions].filter(Boolean))].join(' | ')
}
