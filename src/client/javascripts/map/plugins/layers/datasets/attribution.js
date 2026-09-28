import { isLayerStateVisible } from '../reducer.js'

export function getAttribution (pluginState, baseAttribution) {
  const visibleAttributions = pluginState.layers
    .filter(isLayerStateVisible)
    .map(layer => layer.source?.attribution)
    .filter(Boolean)

  return [...new Set([baseAttribution, ...visibleAttributions].filter(Boolean))].join(' | ')
}
