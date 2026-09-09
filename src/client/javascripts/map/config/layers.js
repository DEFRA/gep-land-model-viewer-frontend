export const SELECTION_Z_INDEX = 100

const LAYER_ID_PREFIX = 'gep-'
const OVERVIEW_ID_SUFFIX = '-overview'

/** @param {{ id: string }} dataset */
export function layerIdFor (dataset) {
  return `${LAYER_ID_PREFIX}${dataset.id}`
}

/** @param {string} layerId */
export function overviewIdFor (layerId) {
  return `${layerId}${OVERVIEW_ID_SUFFIX}`
}

/**
 * @param {import('ol/layer/Layer').default} layer
 * @param {any[]} datasets
 */
export function datasetForLayer (layer, datasets) {
  const layerId = layer.get('id')

  return datasets.find((dataset) => {
    const datasetLayerId = layerIdFor(dataset)

    return datasetLayerId === layerId || overviewIdFor(datasetLayerId) === layerId
  })
}
