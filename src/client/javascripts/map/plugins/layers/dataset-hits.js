import Feature from 'ol/Feature.js'
import VectorLayer from 'ol/layer/Vector.js'
import VectorSource from 'ol/source/Vector.js'
import GeoJSON from 'ol/format/GeoJSON.js'
import Style from 'ol/style/Style.js'
import Fill from 'ol/style/Fill.js'
import Stroke from 'ol/style/Stroke.js'
import { datasets } from '../../config/datasets.js'
import { datasetForLayer, layerIdFor, overviewIdFor, OVERLAY_Z_INDEX } from '../../config/layers.js'
import { DEFRA_GREEN, DEFRA_GREEN_DARK, withAlpha } from '../../config/colours.js'
import { EPSG_27700, UNKNOWN_LAYER_LABEL } from './constants.js'
import { getSourceUrl, getVisibleWmsLayers } from './wms-layer.js'
import { isCoarsePointer } from '../../pointer.js'
import { queryFgbNearPoint } from './fgb-lookup.js'
import { renderDatasetAttributesHtml } from './render.js'

const DATASET_PANEL_TITLE = 'Data layer attributes'

const FINE_POINTER_HIT_TOLERANCE = 3
const COARSE_POINTER_HIT_TOLERANCE = 12

const HIGHLIGHT_STYLE = new Style({
  fill: new Fill({ color: withAlpha(DEFRA_GREEN, 0.25) }),
  stroke: new Stroke({ color: DEFRA_GREEN_DARK, width: 2 })
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

    clear () {
      source.clear()
    }
  }
}

/**
 * A hit source for the info panel covering every visible operational dataset
 * layer: FlatGeobuf features (and their overview tiles), COG raster bands and
 * WMS GetFeatureInfo.
 *
 * @param {import('ol/Map').default} map
 * @returns {import('../info-panel/index.js').HitSource}
 */
export function createDatasetHitSource (map) {
  const highlight = createHighlight(map)

  return {
    async getHits (coords, { signal }) {
      const pixel = map.getPixelFromCoordinate(coords)
      const vectorHits = vectorHitsAt(map, highlight, pixel, coords)
      const rasterHits = rasterHitsAt(map, pixel)
      const wmsHits = await wmsHitsAt(map, highlight, coords, signal)
      return [...vectorHits, ...rasterHits, ...wmsHits]
    },

    clearSelection () {
      highlight.clear()
    }
  }
}

function isFgbLayer (layer) {
  return datasetForLayer(layer, datasets)?.source.type === 'fgb'
}

function isOverviewLayer (layer) {
  const dataset = datasetForLayer(layer, datasets)
  return layer.get('id') === overviewIdFor(layerIdFor(dataset))
}

function vectorHitsAt (map, highlight, pixel, coords) {
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
    layerFilter: (layer) => isFgbLayer(layer) && !isOverviewLayer(layer)
  })

  // Overview drawing is generalised, so allow a near miss, wider for touch.
  map.forEachFeatureAtPixel(pixel, collect, {
    layerFilter: (layer) => isFgbLayer(layer) && isOverviewLayer(layer),
    hitTolerance: isCoarsePointer() ? COARSE_POINTER_HIT_TOLERANCE : FINE_POINTER_HIT_TOLERANCE
  })

  return [...grouped.values()].map(({ dataset, matches }) => makeVectorHit(map, highlight, dataset, matches, coords))
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

    renderHtml: (details) => renderDatasetAttributesHtml(dataset.label, details)
  }
}

function featureProperties (feature) {
  const geometryName = feature.getGeometryName?.()
  return Object.fromEntries(
    Object.entries(feature.getProperties()).filter(([key]) => key !== geometryName)
  )
}

function rasterHitsAt (map, pixel) {
  const hits = []

  for (const layer of map.getLayers().getArray()) {
    const dataset = datasetForLayer(layer, datasets)
    if (dataset?.source.type !== 'cog' || !layer.getVisible()) {
      continue
    }

    // The last band is the mask, zero means no data under the pixel.
    const bands = layer.getData(pixel)
    if (!bands?.at(-1)) {
      continue
    }

    const values = Object.fromEntries(
      Array.from(bands.slice(0, -1), (value, index) => [`Band ${index + 1}`, value])
    )
    hits.push({
      label: dataset.label,
      panelTitle: DATASET_PANEL_TITLE,
      stillValid: () => layer.getVisible(),
      loadDetails: async () => [values],
      renderHtml: (details) => renderDatasetAttributesHtml(dataset.label, details)
    })
  }

  return hits
}

async function wmsHitsAt (map, highlight, coords, signal) {
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
        renderHtml: (details) => renderDatasetAttributesHtml(label, details)
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
        renderHtml: (details) => renderDatasetAttributesHtml(label, details)
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
