import GeoTIFF from 'ol/source/GeoTIFF.js'
import WebGLTileLayer from 'ol/layer/WebGLTile.js'
import { EPSG_27700 } from '../../constants.js'
import { buildCogColourExpression } from '../style-config.js'

function cogStyleFor (styleConfig, detailReady) {
  const color = buildCogColourExpression(styleConfig)
  return detailReady === undefined
    ? { color }
    : {
        variables: { detailReady: Number(detailReady) },
        color: ['case', ['==', ['var', 'detailReady'], 1], ['color', 0, 0, 0, 0], color]
      }
}

// GeoTIFF leaves getView() pending after a metadata error, so source state
// must be watched as well.
function waitForMetadata (source) {
  return new Promise((resolve, reject) => {
    let settled = false

    function settle (callback, value) {
      if (settled) {
        return
      }

      settled = true
      source.un('change', onChange)
      callback(value)
    }

    function onChange () {
      if (source.getState() === 'error') {
        settle(reject, source.getError() ?? new Error('COG metadata failed to load'))
      }
    }

    source.on('change', onChange)
    onChange()
    if (!settled) {
      source.getView().then(
        metadata => settle(resolve, metadata),
        error => settle(reject, error)
      )
    }
  })
}

async function createCogMapLayers (options, styleConfig, detailReady) {
  await waitForMetadata(options.source)
  const layer = new WebGLTileLayer({ ...options, style: cogStyleFor(styleConfig, detailReady) })

  return {
    layers: [layer],
    applyStyle: next => layer.setStyle(cogStyleFor(next, detailReady)),
    setDetailReady (next) {
      if (next === detailReady) {
        return
      }

      detailReady = next
      layer.set('detailReady', next)
      // Layer opacity affects the shared canvas, so hide just the raster pixels.
      layer.updateStyleVariables({ detailReady: Number(next) })
    },
    setOpacity: next => layer.setOpacity(next)
  }
}

/**
 * Creates a WebGL tile layer for a Cloud Optimised GeoTIFF.
 *
 * @param {object} layerConfig Layer config with a cog source
 * @param {string} layerId Map layer id
 * @param {object} presentation Resolved layer style and opacity
 * @returns Map layers with raster styling and opacity controls
 */
export async function createCogLayer (layerConfig, layerId, { styleConfig, opacity }) {
  const { url } = layerConfig.source

  return createCogMapLayers({
    properties: { id: layerId },
    source: new GeoTIFF({ sources: [{ url }], normalize: false, interpolate: false }),
    opacity
  }, styleConfig)
}

/**
 * Creates the COG underlay used until FlatGeobuf detail is ready.
 *
 * @param {object} overview Overview definition with a cog url
 * @param {string} layerId Map layer id
 * @param {object} options
 * @param {object} options.styleConfig Resolved style theme
 * @param {string} options.className Shared WebGL canvas class
 * @returns Map layers for the raster overview
 */
export async function createCogOverviewLayer (overview, layerId, { styleConfig, className }) {
  const source = new GeoTIFF({
    sources: [{ url: overview.url }],
    // Normalising or interpolating would create values outside the class table.
    normalize: false,
    interpolate: false,
    wrapX: false,
    projection: EPSG_27700,
    // Newly loaded overview tiles must cover missing detail immediately.
    transition: 0
  })

  return createCogMapLayers({
    properties: { id: layerId },
    source,
    opacity: 1,
    className,
    // Load every ancestor tile so OL can stretch one over gaps during movement.
    preload: Infinity
  }, styleConfig, false)
}
