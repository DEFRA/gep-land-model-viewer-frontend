import { layerIdFor, overviewIdFor } from '../../../config/layers.js'
import { createCogLayer } from './layers/cog.js'
import { createFlatGeobufLayers } from './layers/fgb.js'
import { createWmsLayer } from './layers/wms.js'

function findDatasetLayers (map, layerId) {
  return map.getLayers().getArray()
    .filter(l => l.get('id') === layerId || l.get('id') === overviewIdFor(layerId))
}

// An overview removes the zoom floor; otherwise use the detail layer's first
// rendered zoom.
function datasetZoomFloor (layers, layerId) {
  if (layers.some(candidate => candidate.get('id') === overviewIdFor(layerId))) {
    return undefined
  }

  const detailLayer = layers.find(candidate => candidate.get('id') === layerId)
  if (!detailLayer) {
    return undefined
  }

  const minZoom = detailLayer.getMinZoom()
  if (minZoom !== -Infinity) {
    // OL's minZoom is exclusive, the first drawn zoom is the one above it.
    return minZoom + 1
  }

  return undefined
}

async function createDatasetLayers (dataset, layerId, map) {
  const { type } = dataset.source
  if (type === 'cog') {
    return [await createCogLayer(dataset, layerId)]
  } else if (type === 'fgb') {
    return createFlatGeobufLayers(dataset, layerId, map)
  } else if (type === 'wms') {
    const wmsLayer = await createWmsLayer(dataset, layerId)
    return wmsLayer ? [wmsLayer] : []
  } else {
    return []
  }
}

async function toggleLayer (dataset, visible, map) {
  const layerId = layerIdFor(dataset)
  const existing = findDatasetLayers(map, layerId)
  if (existing.length > 0) {
    existing.forEach(existingLayer => existingLayer.setVisible(visible))
    return
  }

  if (!visible) {
    return
  }

  const layers = await createDatasetLayers(dataset, layerId, map)
  layers.forEach(createdLayer => map.addLayer(createdLayer))
}

/**
 * Toggles a dataset and returns its resulting visibility and minimum zoom.
 * @param {import('ol/Map').default} map
 * @returns {Promise<{ visible: boolean, minZoom: number | undefined }>}
 */
export async function toggleDataset (map, dataset, visible) {
  try {
    await toggleLayer(dataset, visible, map)
  } catch (err) {
    console.error(`Failed to load data layer ${dataset.id}`, err)
  }

  const layerId = layerIdFor(dataset)
  const layers = findDatasetLayers(map, layerId)
  const shown = visible && layers.length > 0

  return {
    visible: shown,
    minZoom: shown ? datasetZoomFloor(layers, layerId) : undefined
  }
}
