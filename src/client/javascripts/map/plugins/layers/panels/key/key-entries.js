import { visibleStyleDefinitions } from '../shared/swatch-helpers.js'

/**
 * @typedef {{ id: string, label: string } & (
 * { type: 'wms', baseUrl: string, layerNames: string[] } |
 * { type: 'style', styles: import('../shared/swatch-helpers.js').StyleDefinition[] }
 * )} KeyEntry
 */

/** @returns {KeyEntry | null} */
function wmsEntry (dataset, layer) {
  const layerNames = layer.wmsLayerNames
  if (dataset.source.type !== 'wms' || !layerNames?.length || !dataset.source.url) {
    return null
  }

  return {
    type: 'wms',
    id: dataset.id,
    label: dataset.label,
    baseUrl: dataset.source.url,
    layerNames
  }
}

/**
 * @param {object[]} datasets
 * @param {import('../../reducer.js').LayersState} pluginState
 */
export function getKeyEntries (datasets, pluginState) {
  /** @type {KeyEntry[]} */
  const entries = []

  for (const layer of pluginState.layers) {
    const dataset = datasets.find(candidate => candidate.id === layer.id)
    if (!dataset || layer.hidden || !layer.ready) {
      continue
    }

    if (dataset.source.styleConfig) {
      const styles = visibleStyleDefinitions(dataset.source.styleConfig)
      if (styles.length) {
        entries.push({ type: 'style', id: layer.id, label: dataset.label, styles })
      }
    } else {
      const entry = wmsEntry(dataset, layer)
      if (entry) {
        entries.push(entry)
      }
    }
  }

  return entries
}
