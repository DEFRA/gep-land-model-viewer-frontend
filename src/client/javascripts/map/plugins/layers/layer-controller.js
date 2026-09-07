import { SELECTION_Z_INDEX, layerIdFor, overviewIdFor } from '../../config/layers.js'
import { createCogLayer } from './datasets/layers/cog.js'
import { createFlatGeobufLayers } from './datasets/layers/fgb.js'
import { createWmsLayer } from './datasets/layers/wms.js'
import { isLayerStateVisible } from './reducer.js'

// OpenLayers render order, bottom to top:
// [basemap, ...Contents rows from bottom to top, fixed selection layers]
const MAX_MANAGED_LAYER_Z_INDEX = SELECTION_Z_INDEX - 1

function layerZIndexes (layers) {
  const step = MAX_MANAGED_LAYER_Z_INDEX / Math.max(layers.length, 1)

  return new Map(layers.map(({ id }, index) => [id, step * (layers.length - index)]))
}

function datasetZoomFloor (layers, layerId) {
  if (layers.some(layer => layer.get('id') === overviewIdFor(layerId))) {
    return undefined
  }

  const minZoom = layers.find(layer => layer.get('id') === layerId)?.getMinZoom()
  return minZoom !== undefined && minZoom !== -Infinity ? minZoom + 1 : undefined
}

function wmsLayerNames (dataset, layers) {
  if (dataset.source.type !== 'wms') {
    return undefined
  }

  const names = layers[0]?.getSource()?.getParams()?.LAYERS
  return names ? names.split(',') : undefined
}

async function createDatasetLayers (dataset, map) {
  const layerId = layerIdFor(dataset)

  switch (dataset.source.type) {
    case 'cog':
      return [await createCogLayer(dataset, layerId)]
    case 'fgb':
      return createFlatGeobufLayers(dataset, layerId, map)
    case 'wms': {
      const layer = await createWmsLayer(dataset, layerId)
      return layer ? [layer] : []
    }
    default:
      return []
  }
}

function metadataFor (dataset, layers) {
  const metadata = { minZoom: datasetZoomFloor(layers, layerIdFor(dataset)) }
  const layerNames = wmsLayerNames(dataset, layers)

  return layerNames ? { ...metadata, wmsLayerNames: layerNames } : metadata
}

function syncDatasetLayers (layers, layerState, zIndex) {
  const visible = isLayerStateVisible(layerState)

  if (zIndex !== undefined) {
    for (const layer of layers) {
      layer.setZIndex(zIndex)
    }
  }

  for (const layer of layers) {
    layer.setVisible(visible)
  }
}

export function createLayerController ({ map, datasets, summaries, onDatasetLoaded, onDatasetFailed }) {
  const datasetsById = new Map(datasets.map(dataset => [dataset.id, dataset]))
  const loadedDatasetsById = new Map()
  const loadingDatasetIds = new Set()
  let layerStatesById = new Map()
  let zIndexesById = new Map()
  let disposed = false

  function removeDatasetLayers (layers) {
    for (const layer of layers) {
      map.removeLayer(layer)
    }
  }

  function notifyDatasetLoaded (id, metadata, layerState) {
    if (!layerState || layerState.ready) {
      return
    }

    onDatasetLoaded(id, metadata)
  }

  function notifyDatasetFailed (id, error) {
    if (disposed || !layerStatesById.has(id)) {
      return
    }

    console.error(`Failed to load data layer ${id}`, error)
    onDatasetFailed(id)
  }

  async function ensureDatasetLoaded (id, dataset) {
    if (loadedDatasetsById.has(id) || loadingDatasetIds.has(id)) {
      return
    }

    loadingDatasetIds.add(id)

    try {
      const layers = await createDatasetLayers(dataset, map)
      if (!layers.length) {
        throw new Error('No OpenLayers layers were created')
      }

      if (disposed) {
        removeDatasetLayers(layers)
        return
      }

      for (const layer of layers) {
        layer.setVisible(false)
      }

      for (const layer of layers) {
        map.addLayer(layer)
      }

      const loadedDataset = {
        layers,
        metadata: metadataFor(dataset, layers)
      }
      loadedDatasetsById.set(id, loadedDataset)
      const layerState = layerStatesById.get(id)
      syncDatasetLayers(layers, layerState, zIndexesById.get(id))
      notifyDatasetLoaded(id, loadedDataset.metadata, layerState)
    } catch (error) {
      notifyDatasetFailed(id, error)
    } finally {
      loadingDatasetIds.delete(id)
    }
  }

  function syncSummaries () {
    for (const [id, summary] of Object.entries(summaries)) {
      const layerState = layerStatesById.get(id)
      const zIndex = zIndexesById.get(id)

      if (zIndex !== undefined) {
        summary.setZIndex(zIndex)
      }
      summary.setVisible(isLayerStateVisible(layerState))
    }
  }

  function sync (layerStates) {
    if (disposed) {
      return
    }

    layerStatesById = new Map(layerStates.map(layer => [layer.id, layer]))
    zIndexesById = layerZIndexes(layerStates)

    syncSummaries()

    for (const [id, loadedDataset] of loadedDatasetsById) {
      const layerState = layerStatesById.get(id)
      syncDatasetLayers(loadedDataset.layers, layerState, zIndexesById.get(id))
      notifyDatasetLoaded(id, loadedDataset.metadata, layerState)
    }

    for (const { id } of layerStates) {
      const dataset = datasetsById.get(id)
      if (dataset) {
        ensureDatasetLoaded(id, dataset)
      }
    }
  }

  function dispose () {
    if (disposed) {
      return
    }

    disposed = true
    for (const { layers } of loadedDatasetsById.values()) {
      removeDatasetLayers(layers)
    }
    loadedDatasetsById.clear()
    loadingDatasetIds.clear()
    layerStatesById.clear()
  }

  return { sync, dispose }
}
