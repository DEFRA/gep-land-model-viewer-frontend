import { SUMMARIES } from '../../summaries/config.js'
import { getLayerStyle } from '../../datasets/layer-style.js'
import { swatchColours, visibleStyleDefinitions } from '../shared/swatch-helpers.js'

/**
 * @typedef {{ type: 'wms' } |
 * { type: 'style', definition: import('../shared/swatch-helpers.js').StyleDefinition } |
 * { type: 'colours', colours: number[][] } |
 * { type: 'line', colour: string, width: number, directions: string[] }} ContentsSwatch
 */

/**
 * @typedef {object} ContentsEntry
 * @property {string} id
 * @property {'dataset' | 'summary'} kind
 * @property {string} label
 * @property {boolean} hidden
 * @property {boolean} loading
 * @property {ContentsSwatch} swatch
 */

/** @returns {ContentsEntry} */
function datasetEntry (dataset, layer) {
  const { styleConfig } = getLayerStyle(dataset, layer)
  const definitions = visibleStyleDefinitions(styleConfig)
  /** @type {ContentsSwatch} */
  let swatch

  if (definitions.length === 1) {
    swatch = { type: 'style', definition: definitions[0] }
  } else if (styleConfig) {
    swatch = { type: 'colours', colours: swatchColours(definitions) }
  } else {
    swatch = { type: 'wms' }
  }

  return {
    id: dataset.id,
    kind: 'dataset',
    label: dataset.label,
    hidden: Boolean(layer.hidden),
    loading: !layer.ready,
    swatch
  }
}

/** @returns {ContentsEntry} */
function summaryEntry (summary, layer) {
  return {
    id: summary.id,
    kind: 'summary',
    label: summary.label,
    hidden: Boolean(layer.hidden),
    loading: !layer.ready,
    swatch: summary.symbol
  }
}

/**
 * @param {object[]} datasets
 * @param {import('../../reducer.js').LayersState} pluginState
 * @returns {ContentsEntry[]}
 */
export function getContentsEntries (datasets, pluginState) {
  const entries = []

  for (const layer of pluginState.layers) {
    const dataset = datasets.find(candidate => candidate.id === layer.id)
    if (dataset) {
      entries.push(datasetEntry(dataset, layer))
      continue
    }

    const summary = SUMMARIES.find(candidate => candidate.id === layer.id)
    if (summary) {
      entries.push(summaryEntry(summary, layer))
    }
  }

  return entries
}
