import { isLayerVisible } from '../reducer.js'

export function getAttribution (datasets, pluginState, baseAttribution) {
  const visibleAttributions = datasets
    .filter(dataset => isLayerVisible(pluginState, dataset.id))
    .map(dataset => dataset.source.attribution)
    .filter(Boolean)

  return [...new Set([baseAttribution, ...visibleAttributions].filter(Boolean))].join(' | ')
}
