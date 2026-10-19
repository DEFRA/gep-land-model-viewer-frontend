import { SELECTION_Z_INDEX, layerIdFor, overviewIdFor } from '../../config/layers.js'
import { createCogLayer } from './data-layers/layers/cog.js'
import { createFlatGeobufLayer } from './data-layers/layers/fgb.js'
import { createWmsLayer } from './data-layers/layers/wms.js'
import { getLayerStyle } from './data-layers/layer-style.js'
import { isLayerStateVisible } from './reducer.js'

// OpenLayers render order, bottom to top:
// [basemap, ...Contents rows from bottom to top, fixed selection layers]
const MAX_MANAGED_LAYER_Z_INDEX = SELECTION_Z_INDEX - 1

function layerZIndexes (layers) {
  const step = MAX_MANAGED_LAYER_Z_INDEX / Math.max(layers.length, 1)

  return new Map(layers.map(({ id }, index) => [id, step * (layers.length - index)]))
}

function zoomFloor (layers, layerId) {
  if (layers.some(layer => layer.get('id') === overviewIdFor(layerId))) {
    return undefined
  }

  const minZoom = layers.find(layer => layer.get('id') === layerId)?.getMinZoom()
  return minZoom !== undefined && minZoom !== -Infinity ? minZoom + 1 : undefined
}

function wmsLayerNames (layerConfig, layers) {
  if (layerConfig.source.type !== 'wms') {
    return undefined
  }

  const names = layers[0]?.getSource()?.getParams()?.LAYERS
  return names ? names.split(',') : undefined
}

async function createMapLayers (layerConfig, map, style) {
  const layerId = layerIdFor(layerConfig)

  switch (layerConfig.source.type) {
    case 'cog':
      return createCogLayer(layerConfig, layerId, style)
    case 'fgb':
      return createFlatGeobufLayer(layerConfig, layerId, map, style)
    case 'wms':
      return createWmsLayer(layerConfig, layerId, style)
    default:
      return null
  }
}

function metadataFor (layerConfig, layers) {
  const metadata = { source: layerConfig.source, minZoom: zoomFloor(layers, layerIdFor(layerConfig)) }
  const layerNames = wmsLayerNames(layerConfig, layers)

  return layerNames ? { ...metadata, wmsLayerNames: layerNames } : metadata
}

function syncVisibilityAndOrder (layers, layerState, zIndex) {
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

function syncStyle (loadedLayer, layerState) {
  const { layerConfig, applyStyle, setOpacity } = loadedLayer
  const { theme, overrides, styleConfig, opacity } = getLayerStyle({ ...layerState, source: layerConfig.source })

  if (theme && (theme !== loadedLayer.theme || overrides !== loadedLayer.overrides)) {
    applyStyle(styleConfig)
  }

  if (opacity !== loadedLayer.opacity) {
    setOpacity(opacity)
  }

  loadedLayer.theme = theme
  loadedLayer.overrides = overrides
  loadedLayer.opacity = opacity
}

export function createLayerController ({ map, drawnLayers, loadLayer, onLayerLoaded, onLayerFailed }) {
  const loadedLayersById = new Map()
  const loadingLayerIds = new Set()
  let layerStatesById = new Map()
  let zIndexesById = new Map()
  let disposed = false
  const controller = new AbortController()

  function removeMapLayers (layers) {
    for (const layer of layers) {
      map.removeLayer(layer)
    }
  }

  function notifyLoaded (id, metadata, layerState) {
    if (!layerState || layerState.ready) {
      return
    }

    onLayerLoaded(id, metadata)
  }

  function notifyFailed (id, error) {
    if (disposed || !layerStatesById.has(id)) {
      return
    }

    console.error(`Failed to load data layer ${id}`, error)
    onLayerFailed(id)
  }

  async function ensureLoaded (id, layerUrl) {
    if (loadedLayersById.has(id) || loadingLayerIds.has(id)) {
      return
    }

    loadingLayerIds.add(id)

    try {
      const layerConfig = await loadLayer(id, layerUrl, controller.signal)
      if (disposed) {
        return
      }

      const style = getLayerStyle({ ...layerStatesById.get(id), source: layerConfig.source })
      const mapLayers = await createMapLayers(layerConfig, map, style)
      if (!mapLayers?.layers.length) {
        throw new Error('No OpenLayers layers were created')
      }

      const { layers } = mapLayers
      if (disposed) {
        removeMapLayers(layers)
        return
      }

      for (const layer of layers) {
        layer.setVisible(false)
      }

      for (const layer of layers) {
        map.addLayer(layer)
      }

      const loadedLayer = {
        layerConfig,
        ...mapLayers,
        theme: style.theme,
        overrides: style.overrides,
        opacity: style.opacity,
        metadata: metadataFor(layerConfig, layers)
      }
      loadedLayersById.set(id, loadedLayer)
      const layerState = layerStatesById.get(id)
      syncStyle(loadedLayer, layerState)
      syncVisibilityAndOrder(layers, layerState, zIndexesById.get(id))
      notifyLoaded(id, loadedLayer.metadata, layerState)
    } catch (error) {
      notifyFailed(id, error)
    } finally {
      loadingLayerIds.delete(id)
    }
  }

  function syncDrawnLayers () {
    for (const [id, drawn] of Object.entries(drawnLayers)) {
      const layerState = layerStatesById.get(id)
      const zIndex = zIndexesById.get(id)

      if (zIndex !== undefined) {
        drawn.setZIndex(zIndex)
      }
      drawn.setVisible(isLayerStateVisible(layerState))
    }
  }

  function sync (layerStates) {
    if (disposed) {
      return
    }

    layerStatesById = new Map(layerStates.map(layer => [layer.id, layer]))
    zIndexesById = layerZIndexes(layerStates)

    syncDrawnLayers()

    for (const [id, loadedLayer] of loadedLayersById) {
      const layerState = layerStatesById.get(id)
      syncStyle(loadedLayer, layerState)
      syncVisibilityAndOrder(loadedLayer.layers, layerState, zIndexesById.get(id))
      notifyLoaded(id, loadedLayer.metadata, layerState)
    }

    for (const { id, layerUrl } of layerStates) {
      if (layerUrl) {
        ensureLoaded(id, layerUrl)
      }
    }
  }

  function dispose () {
    if (disposed) {
      return
    }

    disposed = true
    controller.abort()
    for (const { layers } of loadedLayersById.values()) {
      removeMapLayers(layers)
    }
    loadedLayersById.clear()
    loadingLayerIds.clear()
    layerStatesById.clear()
  }

  return { sync, dispose }
}
