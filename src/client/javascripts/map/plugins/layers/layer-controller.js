import { SELECTION_Z_INDEX, layerIdFor, overviewIdFor } from '../../config/layers.js'
import { createCogLayer } from './datasets/layers/cog.js'
import { createFlatGeobufLayer } from './datasets/layers/fgb.js'
import { createWmsLayer } from './datasets/layers/wms.js'
import { getLayerStyle } from './datasets/layer-style.js'
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

async function createDatasetLayer (dataset, map) {
  const layerId = layerIdFor(dataset)

  switch (dataset.source.type) {
    case 'cog':
      return createCogLayer(dataset, layerId)
    case 'fgb':
      return createFlatGeobufLayer(dataset, layerId, map)
    case 'wms':
      return createWmsLayer(dataset, layerId)
    default:
      return null
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

function syncDatasetStyle (loadedDataset, layerState) {
  const { dataset, applyStyle, setOpacity } = loadedDataset
  const styleOverrides = layerState?.styleOverrides

  if (styleOverrides !== loadedDataset.styleOverrides && dataset.source.styleConfig) {
    applyStyle(getLayerStyle(dataset, layerState).styleConfig)
  }

  const opacity = layerState?.opacity ?? dataset.source.opacity
  if (opacity !== loadedDataset.opacity) {
    setOpacity(opacity)
  }

  loadedDataset.styleOverrides = styleOverrides
  loadedDataset.opacity = opacity
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
      const datasetLayer = await createDatasetLayer(dataset, map)
      if (!datasetLayer?.layers.length) {
        throw new Error('No OpenLayers layers were created')
      }

      const { layers } = datasetLayer
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
        dataset,
        ...datasetLayer,
        opacity: dataset.source.opacity,
        metadata: metadataFor(dataset, layers)
      }
      loadedDatasetsById.set(id, loadedDataset)
      const layerState = layerStatesById.get(id)
      syncDatasetStyle(loadedDataset, layerState)
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
      syncDatasetStyle(loadedDataset, layerState)
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
