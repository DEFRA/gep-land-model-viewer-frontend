import { visibleStyleDefinitions } from '../shared/swatch-helpers.js'
import { getLayerStyle } from '../../datasets/layer-style.js'

/**
 * @typedef {{ id: string, label: string } & (
 * { type: 'wms', baseUrl: string, layerNames: string[] } |
 * { type: 'style', styles: import('../shared/swatch-helpers.js').StyleDefinition[] }
 * )} KeyEntry
 */

/** @returns {KeyEntry | null} */
function wmsEntry (layer) {
  const layerNames = layer.wmsLayerNames
  if (layer.source.type !== 'wms' || !layerNames?.length || !layer.source.url) {
    return null
  }

  return {
    type: 'wms',
    id: layer.id,
    label: layer.title,
    baseUrl: layer.source.url,
    layerNames
  }
}

/**
 * @param {import('../../reducer.js').LayersState} pluginState
 */
export function getKeyEntries (pluginState) {
  /** @type {KeyEntry[]} */
  const entries = []

  for (const layer of pluginState.layers) {
    if (!layer.source || layer.hidden || !layer.ready) {
      continue
    }

    const { styleConfig } = getLayerStyle(layer)
    if (styleConfig) {
      const styles = visibleStyleDefinitions(styleConfig)
      if (styles.length) {
        entries.push({ type: 'style', id: layer.id, label: layer.title, styles })
      }
    } else {
      const entry = wmsEntry(layer)
      if (entry) {
        entries.push(entry)
      }
    }
  }

  return entries
}
