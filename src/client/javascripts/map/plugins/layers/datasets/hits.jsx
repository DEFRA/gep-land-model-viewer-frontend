import Feature from 'ol/Feature.js'
import Point from 'ol/geom/Point.js'
import VectorLayer from 'ol/layer/Vector.js'
import VectorSource from 'ol/source/Vector.js'
import GeoJSON from 'ol/format/GeoJSON.js'
import Style from 'ol/style/Style.js'
import Fill from 'ol/style/Fill.js'
import RegularShape from 'ol/style/RegularShape.js'
import Stroke from 'ol/style/Stroke.js'
import { datasetForLayer, layerIdFor, overviewIdFor, OVERLAY_Z_INDEX } from '../../../config/layers.js'
import { DEFRA_GREEN, DEFRA_GREEN_DARK, withAlpha } from '../../../config/colours.js'
import { EPSG_27700, UNKNOWN_LAYER_LABEL } from '../constants.js'
import { getSourceUrl, getVisibleWmsLayers } from './layers/wms.js'
import { isCoarsePointer } from '../../../pointer.js'
import { queryFgbNearPoint } from './layers/fgb-lookup.js'
import { DatasetAttributes } from './DatasetAttributes.jsx'
import { classForBands } from './style-config.js'

const FINE_POINTER_HIT_TOLERANCE = 3
const COARSE_POINTER_HIT_TOLERANCE = 12
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
    zIndex: OVERLAY_Z_INDEX + 1,
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
 * A hit source for visible FlatGeobuf, COG and WMS datasets.
 *
 * @param {import('ol/Map').default} map
 * @param {Array<object>} datasets
 * @returns {import('../inspection/index.js').HitSource & { dispose: () => void }}
 */
export function createDatasetHits (map, datasets) {
  const highlight = createHighlight(map)

  return {
    async getHits (coords, { signal }) {
      const pixel = map.getPixelFromCoordinate(coords)
      const { hits: vectorHits, datasetIds: vectorHitDatasetIds } = vectorHitsAt(map, datasets, highlight, pixel, coords)
      const cogOverviewHits = cogOverviewHitsAt(map, datasets, highlight, pixel, coords, vectorHitDatasetIds)
      const rasterHits = rasterHitsAt(map, datasets, highlight, pixel, coords)
      const wmsHits = await wmsHitsAt(map, datasets, highlight, coords, signal)
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

function isFgbLayer (layer, datasets) {
  return datasetForLayer(layer, datasets)?.source.type === 'fgb'
}

function isOverviewLayer (layer, datasets) {
  const dataset = datasetForLayer(layer, datasets)
  return layer.get('id') === overviewIdFor(layerIdFor(dataset))
}

function vectorHitsAt (map, datasets, highlight, pixel, coords) {
  const grouped = new Map()

  const collect = (feature, layer) => {
    const dataset = datasetForLayer(layer, datasets)
    if (!dataset) {
      return
    }
    const group = grouped.get(dataset.id)
    if (group) {
      group.matches.push({ feature, layer })
    } else {
      grouped.set(dataset.id, { dataset, matches: [{ feature, layer }] })
    }
  }

  map.forEachFeatureAtPixel(pixel, collect, {
    layerFilter: (layer) => isFgbLayer(layer, datasets) && !isOverviewLayer(layer, datasets)
  })

  // Overview drawing is generalised, so allow a near miss, wider for touch.
  map.forEachFeatureAtPixel(pixel, collect, {
    layerFilter: (layer) => isFgbLayer(layer, datasets) && isOverviewLayer(layer, datasets),
    hitTolerance: isCoarsePointer() ? COARSE_POINTER_HIT_TOLERANCE : FINE_POINTER_HIT_TOLERANCE
  })

  return {
    hits: [...grouped.values()].map(({ dataset, matches }) => makeVectorHit(map, highlight, dataset, matches, coords)),
    datasetIds: new Set(grouped.keys())
  }
}

function makeVectorHit (map, highlight, dataset, matches, coords) {
  const overviewId = overviewIdFor(layerIdFor(dataset))
  const detailMatches = matches.filter((match) => match.layer.get('id') !== overviewId)
  // Overview tiles carry generalised RenderFeatures, the real geometry comes
  // back with the FlatGeobuf lookup.
  let geometries = detailMatches.map((match) => match.feature.getGeometry())

  return {
    label: dataset.label,
    panelTitle: DATASET_PANEL_TITLE,
    stillValid: () => matches.some((match) => match.layer.getVisible()),

    select () {
      highlight.show(geometries)
    },

    async loadDetails ({ signal }) {
      if (detailMatches.length) {
        return detailMatches.map((match) => featureProperties(match.feature))
      }

      const resolution = map.getView().getResolution()
      const nearest = await queryFgbNearPoint(dataset.source.url, coords, resolution, { signal })
      if (!nearest) {
        return []
      }

      geometries = [geojson.readGeometry(nearest.geometry)]
      highlight.show(geometries)
      return [nearest.properties ?? {}]
    },

    render: (details) => <DatasetAttributes label={dataset.label} features={details} />
  }
}

function cogOverviewHitsAt (map, datasets, highlight, pixel, coords, vectorHitDatasetIds) {
  const layers = map.getLayers().getArray()

  return layers.flatMap(layer => {
    const dataset = datasetForLayer(layer, datasets)
    if (dataset?.source.overview?.type !== 'cog' || layer.get('id') !== overviewIdFor(layerIdFor(dataset))) {
      return []
    }

    // Loaded vectors give an exact hit. Only fall back to the COG while it is
    // visible and the detail layer has no hit.
    if (!layer.getVisible() || vectorHitDatasetIds.has(dataset.id)) {
      return []
    }

    const detailId = layerIdFor(dataset)
    const detailLayer = layers.find((candidate) => candidate.get('id') === detailId)
    if (!detailLayer?.getVisible()) {
      return []
    }

    const styleConfig = dataset.source.styleConfig
    const classDefinition = classForBands(styleConfig, layer.getData(pixel))
    if (!classDefinition) {
      return []
    }

    return [makeCogOverviewHit(map, highlight, dataset, detailLayer, styleConfig, classDefinition, coords)]
  })
}

function makeCogOverviewHit (map, highlight, dataset, detailLayer, styleConfig, classDefinition, coords) {
  // The COG pixel has a class but no geometry, so the FGB lookup supplies it.
  let geometries = []

  return {
    label: dataset.label,
    panelTitle: DATASET_PANEL_TITLE,
    // Both layers toggle together; detail is the dataset's visibility state.
    stillValid: () => detailLayer.getVisible(),

    select () {
      highlight.show(geometries)
    },

    async loadDetails ({ signal }) {
      const resolution = map.getView().getResolution()
      const nearest = await queryFgbNearPoint(dataset.source.url, coords, resolution, { signal })
      if (!nearest) {
        return [attributesForClass(styleConfig, classDefinition)]
      }

      geometries = [geojson.readGeometry(nearest.geometry)]
      highlight.show(geometries)
      return [nearest.properties ?? {}]
    },

    render: (details) => <DatasetAttributes label={dataset.label} features={details} />
  }
}

function attributesForClass (styleConfig, classDefinition) {
  if (styleConfig.field && classDefinition.fieldValue !== undefined) {
    return { [styleConfig.field]: classDefinition.fieldValue }
  }

  return { Classification: classDefinition.label }
}

function featureProperties (feature) {
  const geometryName = feature.getGeometryName?.()
  return Object.fromEntries(
    Object.entries(feature.getProperties()).filter(([key]) => key !== geometryName)
  )
}

function rasterHitsAt (map, datasets, highlight, pixel, coords) {
  return map.getLayers().getArray().flatMap(layer => {
    const dataset = datasetForLayer(layer, datasets)
    if (dataset?.source.type !== 'cog' || !layer.getVisible()) {
      return []
    }

    const styleConfig = dataset.source.styleConfig
    const classDefinition = classForBands(styleConfig, layer.getData(pixel))
    if (!classDefinition) {
      return []
    }

    const attributes = attributesForClass(styleConfig, classDefinition)
    return [{
      label: dataset.label,
      panelTitle: DATASET_PANEL_TITLE,
      stillValid: () => layer.getVisible(),
      select: () => highlight.showPoint(coords),
      loadDetails: async () => [attributes],
      render: (details) => <DatasetAttributes label={dataset.label} features={details} />
    }]
  })
}

async function wmsHitsAt (map, datasets, highlight, coords, signal) {
  const results = await Promise.all(getVisibleWmsLayers(map).map(async (layer) => {
    const dataset = datasetForLayer(layer, datasets)
    const label = dataset?.label ?? UNKNOWN_LAYER_LABEL

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
        render: (details) => <DatasetAttributes label={label} features={details} />
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
        render: (details) => <DatasetAttributes label={label} features={details} />
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
