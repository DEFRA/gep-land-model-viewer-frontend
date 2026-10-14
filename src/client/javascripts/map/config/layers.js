export const SELECTION_Z_INDEX = 100

const LAYER_ID_PREFIX = 'gep-'
const OVERVIEW_ID_SUFFIX = '-overview'

/** @param {{ id: string }} layerState */
export function layerIdFor (layerState) {
  return `${LAYER_ID_PREFIX}${layerState.id}`
}

/** @param {string} layerId */
export function overviewIdFor (layerId) {
  return `${layerId}${OVERVIEW_ID_SUFFIX}`
}

/**
 * @param {import('ol/layer/Layer').default} layer
 * @param {any[]} layerStates
 */
export function layerStateFor (layer, layerStates) {
  const layerId = layer.get('id')

  return layerStates.find((layerState) => {
    const mainId = layerIdFor(layerState)

    return mainId === layerId || overviewIdFor(mainId) === layerId
  })
}
