import Feature from 'ol/Feature.js'
import Point from 'ol/geom/Point.js'
import VectorLayer from 'ol/layer/Vector.js'
import VectorSource from 'ol/source/Vector.js'
import GeoJSON from 'ol/format/GeoJSON.js'
import Style from 'ol/style/Style.js'
import Fill from 'ol/style/Fill.js'
import RegularShape from 'ol/style/RegularShape.js'
import Stroke from 'ol/style/Stroke.js'
import { layerStateFor, layerIdFor, overviewIdFor, SELECTION_Z_INDEX } from '../../../config/layers.js'
import { DEFRA_GREEN, DEFRA_GREEN_DARK, withAlpha } from '../../../config/colours.js'
import { EPSG_27700, UNKNOWN_LAYER_LABEL } from '../constants.js'
import { getSourceUrl, getVisibleWmsLayers } from './layers/wms.js'
import { queryFgbNearPoint } from './layers/fgb-lookup.js'
import { DatasetAttributes } from './DatasetAttributes.jsx'
import { STYLE_VALUE_PROPERTY, visibleClassForBands, visibleClassForFieldValue } from './style-config.js'
import { getLayerStyle, getLayerTheme } from './layer-style.js'
import { isLayerStateVisible } from '../reducer.js'

const DATASET_PANEL_TITLE = 'Data layer attributes'

const HIGHLIGHT_STYLE = new Style({
  fill: new Fill({ color: withAlpha(DEFRA_GREEN, 0.25) }),
  stroke: new Stroke({ color: DEFRA_GREEN_DARK, width: 2 })
})

const CROSSHAIR_STYLE = new Style({
  image: new RegularShape({
    points: 4,
    radius: 11,
    radius2: 0,
    stroke: new Stroke({ color: DEFRA_GREEN_DARK, width: 2 })
  })
})

const geojson = new GeoJSON()

function createHighlight (map) {
  const source = new VectorSource()
  const layer = new VectorLayer({
    source,
    style: HIGHLIGHT_STYLE,
    zIndex: SELECTION_Z_INDEX,
    properties: { id: 'gep-dataset-highlight' }
  })
  map.addLayer(layer)

  return {
    show (geometries) {
      source.clear()
      for (const geometry of geometries) {
        if (geometry) {
          source.addFeature(new Feature(geometry))
        }
      }
    },

    showPoint (coords) {
      source.clear()
      const feature = new Feature(new Point(coords))
      feature.setStyle(CROSSHAIR_STYLE)
      source.addFeature(feature)
    },

    clear () {
      source.clear()
    },

    dispose () {
      source.clear()
      map.removeLayer(layer)
    }
  }
}

/**
 * @typedef {object} HitOptions
 * @property {(layer: import('../reducer.js').LayerState) => string} label
 * @property {string} [panelTitle]
 * @property {(properties: Record<string, any>[]) => any} toDetails
 * @property {(details: any, layer: import('../reducer.js').LayerState) => import('preact').VNode} render
 */

/** @type {HitOptions} */
const ATTRIBUTE_HIT_OPTIONS = {
  label: layer => layer.title,
  panelTitle: DATASET_PANEL_TITLE,
  toDetails: properties => properties,
  render: (details, layer) => <DatasetAttributes label={layer.title} features={details} datasetId={layer.id} />
}

/**
 * A hit source for visible FlatGeobuf, COG and WMS layers.
 *
 * @param {import('ol/Map').default} map
 * @param {() => import('../reducer.js').LayerState[]} getLayers Current layer state
 * @param {Record<string, HitOptions>} [hitOptions] By layer ID
 * @returns {import('../inspection/index.js').HitSource & { dispose: () => void }}
 */
export function createLayerHits (map, getLayers, hitOptions = {}) {
  const highlight = createHighlight(map)
  const optionsFor = layerState => hitOptions[layerState.id] ?? ATTRIBUTE_HIT_OPTIONS
  const getStyle = layerState => {
    const { theme, styleConfig } = getLayerStyle(layerState)
    return {
      styleConfig,
      isCurrent: () => {
        const layer = getLayers().find(candidate => candidate.id === layerState.id)
        return isLayerStateVisible(layer) && getLayerTheme(layer) === theme
      }
    }
  }

  return {
    async getHits (coords, { signal }) {
      const layerStates = getLayers().filter(layer => layer.source)
      const context = { map, layerStates, highlight, getStyle, optionsFor }
      const pixel = map.getPixelFromCoordinate(coords)
      const { hits: vectorHits, layerIds: vectorHitLayerIds } = vectorHitsAt(context, pixel)
      const cogOverviewHits = cogOverviewHitsAt(context, pixel, coords, vectorHitLayerIds)
      const rasterHits = rasterHitsAt(context, pixel, coords)
      const wmsHits = await wmsHitsAt(map, layerStates, highlight, coords, signal)
      return [...vectorHits, ...cogOverviewHits, ...rasterHits, ...wmsHits]
    },

    clearSelection () {
      highlight.clear()
    },

    dispose () {
      highlight.dispose()
    }
  }
}

function isFgbLayer (layer, layerStates) {
  return layerStateFor(layer, layerStates)?.source.type === 'fgb'
}

function vectorHitsAt ({ map, layerStates, highlight, getStyle, optionsFor }, pixel) {
  const grouped = new Map()

  const collect = (feature, layer) => {
    const layerState = layerStateFor(layer, layerStates)
    if (!layerState) {
      return
    }

    const { styleConfig, isCurrent } = getStyle(layerState)
    if (!featureHasVisibleStyle(feature, styleConfig)) {
      return
    }
    const group = grouped.get(layerState.id)
    if (group) {
      group.matches.push({ feature, layer })
    } else {
      grouped.set(layerState.id, { layerState, matches: [{ feature, layer }], isCurrent })
    }
  }

  map.forEachFeatureAtPixel(pixel, collect, {
    layerFilter: (layer) => isFgbLayer(layer, layerStates)
  })

  return {
    hits: [...grouped.values()].map(({ layerState, matches, isCurrent }) => makeVectorHit({ highlight, layerState, hitOptions: optionsFor(layerState), matches, isCurrent })),
    layerIds: new Set(grouped.keys())
  }
}

function featureHasVisibleStyle (feature, styleConfig) {
  const value = feature.get(styleConfig.field)
  return visibleClassForFieldValue(styleConfig, value) !== null
}

function makeVectorHit ({ highlight, layerState, hitOptions, matches, isCurrent }) {
  const geometries = matches.map((match) => match.feature.getGeometry())

  return {
    label: hitOptions.label(layerState),
    panelTitle: hitOptions.panelTitle,
    stillValid: () => isCurrent() && matches.some((match) => match.layer.getVisible()),

    select () {
      highlight.show(geometries)
    },

    async loadDetails () {
      return hitOptions.toDetails(matches.map((match) => featureProperties(match.feature)))
    },

    render: (details) => hitOptions.render(details, layerState)
  }
}

function cogOverviewHitsAt ({ map, layerStates, highlight, getStyle, optionsFor }, pixel, coords, vectorHitLayerIds) {
  const layers = map.getLayers().getArray()

  return layers.flatMap(layer => {
    const layerState = layerStateFor(layer, layerStates)
    if (!layerState?.source.overview || layer.get('id') !== overviewIdFor(layerIdFor(layerState))) {
      return []
    }

    // Loaded vectors give an exact hit. Only fall back to the COG while it is
    // visible and the detail layer has no hit.
    if (!layer.getVisible() || vectorHitLayerIds.has(layerState.id)) {
      return []
    }

    const detailId = layerIdFor(layerState)
    const detailLayer = layers.find((candidate) => candidate.get('id') === detailId)
    if (!detailLayer?.getVisible()) {
      return []
    }

    const { styleConfig, isCurrent } = getStyle(layerState)
    const classDefinition = visibleClassForBands(styleConfig, layer.getData(pixel), layer.getSource())
    if (!classDefinition) {
      return []
    }

    return [makeCogOverviewHit({ map, highlight, layerState, hitOptions: optionsFor(layerState), detailLayer, styleConfig, classDefinition, coords, isCurrent })]
  })
}

function makeCogOverviewHit ({ map, highlight, layerState, hitOptions, detailLayer, styleConfig, classDefinition, coords, isCurrent }) {
  // The COG pixel has a class but no geometry, so the FGB lookup supplies it.
  let geometries = []

  return {
    label: hitOptions.label(layerState),
    panelTitle: hitOptions.panelTitle,
    stillValid: () => isCurrent() && detailLayer.getVisible(),

    select () {
      highlight.show(geometries)
    },

    async loadDetails ({ signal }) {
      const resolution = map.getView().getResolution()
      const nearest = await queryFgbNearPoint(layerState.source.url, coords, resolution, { signal })
      if (signal.aborted || !isCurrent()) {
        return []
      }

      if (!nearest) {
        return hitOptions.toDetails([attributesForClass(styleConfig, classDefinition)])
      }

      geometries = [geojson.readGeometry(nearest.geometry)]
      highlight.show(geometries)
      return hitOptions.toDetails([nearest.properties ?? {}])
    },

    render: (details) => hitOptions.render(details, layerState)
  }
}

function attributesForClass (styleConfig, classDefinition) {
  if (styleConfig.field && classDefinition.fieldValues?.length === 1) {
    return { [styleConfig.field]: classDefinition.fieldValues[0] }
  }

  return { Classification: classDefinition.label }
}

function featureProperties (feature) {
  const geometryName = feature.getGeometryName?.()
  return Object.fromEntries(
    Object.entries(feature.getProperties()).filter(([key]) => key !== geometryName && key !== STYLE_VALUE_PROPERTY)
  )
}

function rasterHitsAt ({ map, layerStates, highlight, getStyle, optionsFor }, pixel, coords) {
  return map.getLayers().getArray().flatMap(layer => {
    const layerState = layerStateFor(layer, layerStates)
    if (layerState?.source.type !== 'cog' || !layer.getVisible()) {
      return []
    }

    const { styleConfig, isCurrent } = getStyle(layerState)
    const classDefinition = visibleClassForBands(styleConfig, layer.getData(pixel), layer.getSource())
    if (!classDefinition) {
      return []
    }

    const hitOptions = optionsFor(layerState)
    const attributes = attributesForClass(styleConfig, classDefinition)
    return [{
      label: hitOptions.label(layerState),
      panelTitle: hitOptions.panelTitle,
      stillValid: () => isCurrent() && layer.getVisible(),
      select: () => highlight.showPoint(coords),
      loadDetails: async () => hitOptions.toDetails([attributes]),
      render: (details) => hitOptions.render(details, layerState)
    }]
  })
}

async function wmsHitsAt (map, layerStates, highlight, coords, signal) {
  const results = await Promise.all(getVisibleWmsLayers(map).map(async (layer) => {
    const layerState = layerStateFor(layer, layerStates)
    const label = layerState?.title ?? UNKNOWN_LAYER_LABEL

    try {
      const features = await fetchFeatureInfo(layer, coords, map, signal)
      if (!features.length) {
        return null
      }

      const geometries = features
        .filter(feature => feature.geometry)
        .map(feature => geojson.readGeometry(feature.geometry))

      return {
        label,
        panelTitle: DATASET_PANEL_TITLE,
        stillValid: () => layer.getVisible(),

        select () {
          highlight.show(geometries)
        },

        loadDetails: async () => features.map(feature => feature.properties ?? {}),
        render: (details) => <DatasetAttributes label={label} features={details} datasetId={layerState?.id} />
      }
    } catch (error) {
      if (signal.aborted) {
        return null
      }

      // Keep the layer selectable so the failure shows in the panel.
      return {
        label,
        panelTitle: DATASET_PANEL_TITLE,
        stillValid: () => layer.getVisible(),
        loadDetails: async () => {
          throw error
        },
        render: (details) => <DatasetAttributes label={label} features={details} datasetId={layerState?.id} />
      }
    }
  }))

  return results.filter(Boolean)
}

async function fetchFeatureInfo (layer, coords, map, signal) {
  const source = layer.getSource()
  const layerNames = source.getParams().LAYERS
  if (!layerNames) {
    return []
  }

  const pixel = map.getPixelFromCoordinate(coords)
  const view = map.getView()
  const size = map.getSize()
  const extent = view.calculateExtent(size)

  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetFeatureInfo',
    LAYERS: layerNames,
    QUERY_LAYERS: layerNames,
    INFO_FORMAT: 'application/json',
    CRS: EPSG_27700,
    BBOX: `${extent[0]},${extent[1]},${extent[2]},${extent[3]}`,
    WIDTH: String(Math.round(size[0])),
    HEIGHT: String(Math.round(size[1])),
    I: String(Math.round(pixel[0])),
    J: String(Math.round(pixel[1]))
  })

  const response = await fetch(`${getSourceUrl(source)}?${params}`, { signal })
  const data = await response.json()
  return data.features ?? []
}
