import { GRID_SUMMARY } from '../../summaries/config.js'
import { getLayerStyle } from '../../data-layers/layer-style.js'
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
 * @property {string} label
 * @property {boolean} hidden
 * @property {boolean} loading
 * @property {ContentsSwatch} swatch
 */

/** @returns {ContentsSwatch} */
function styleSwatch (layer) {
  const { styleConfig } = getLayerStyle(layer)
  const definitions = visibleStyleDefinitions(styleConfig)

  if (definitions.length === 1) {
    return { type: 'style', definition: definitions[0] }
  }

  if (styleConfig || !layer.source) {
    return { type: 'colours', colours: swatchColours(definitions) }
  }

  return { type: 'wms' }
}

/**
 * @param {import('../../reducer.js').LayersState} pluginState
 * @returns {ContentsEntry[]}
 */
export function getContentsEntries (pluginState) {
  return pluginState.layers.map(layer => {
    const isGrid = layer.id === GRID_SUMMARY.id

    return {
      id: layer.id,
      label: layer.title,
      hidden: Boolean(layer.hidden),
      loading: !layer.ready,
      swatch: isGrid ? /** @type {ContentsSwatch} */ (GRID_SUMMARY.symbol) : styleSwatch(layer)
    }
  })
}
