import { layerStateFor, layerIdFor } from '../../../config/layers.js'
import { VECTOR_STYLE_PROPERTIES, visibleClassForFieldValue } from './style-config.js'
import { getLayerStyle } from './layer-style.js'

function isFgbLayer (layer, layerStates) {
  return layerStateFor(layer, layerStates)?.source.type === 'fgb'
}

function isFgbDetailLayer (layer, layerStates) {
  const layerState = layerStateFor(layer, layerStates)
  return layerState?.source.type === 'fgb' && layer.get('id') === layerIdFor(layerState)
}

function featureHasVisibleStyle (feature, styleConfig) {
  const value = feature.get(styleConfig.field)
  return visibleClassForFieldValue(styleConfig, value) !== null
}

/**
 * Features of the visible FlatGeobuf layers at the pixel, by layer ID, skipping classes with no visible style.
 *
 * @param {any} map
 * @param {import('../reducer.js').LayerState[]} layerStates
 * @param {number[]} pixel
 * @param {number[]} coords
 * @returns {Map<string, { layerState: import('../reducer.js').LayerState, matches: Array<{ feature: any, layer: any }> }>}
 */
export function vectorFeaturesAt (map, layerStates, pixel, coords) {
  const grouped = new Map()

  const collect = (feature, layer) => {
    const layerState = layerStateFor(layer, layerStates)
    if (!layerState) {
      return
    }

    if (!featureHasVisibleStyle(feature, getLayerStyle(layerState).styleConfig)) {
      return
    }
    const group = grouped.get(layerState.id)
    // A feature can come from both lookups, don't add it twice
    if (group?.matches.some((match) => match.feature === feature)) {
      return
    }
    if (group) {
      group.matches.push({ feature, layer })
    } else {
      grouped.set(layerState.id, { layerState, matches: [{ feature, layer }] })
    }
  }

  map.forEachFeatureAtPixel(pixel, collect, {
    layerFilter: (layer) => isFgbLayer(layer, layerStates)
  })

  // WebGL hit detection skips transparent fills, so outline-only classes are
  // found from the source.
  for (const layer of map.getLayers().getArray()) {
    if (isFgbDetailLayer(layer, layerStates) && layer.isVisible()) {
      for (const feature of layer.getSource().getFeaturesAtCoordinate(coords)) {
        collect(feature, layer)
      }
    }
  }

  return grouped
}

export function featureProperties (feature) {
  const geometryName = feature.getGeometryName?.()
  return Object.fromEntries(
    Object.entries(feature.getProperties()).filter(([key]) => key !== geometryName && !VECTOR_STYLE_PROPERTIES.includes(key))
  )
}
