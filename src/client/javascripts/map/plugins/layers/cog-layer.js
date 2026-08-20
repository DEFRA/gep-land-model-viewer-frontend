import GeoTIFF from 'ol/source/GeoTIFF.js'
import WebGLTileLayer from 'ol/layer/WebGLTile.js'
import { EPSG_27700 } from './constants.js'
import { cogColorFor, validateStyleConfig } from './style-config.js'

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

/**
 * Creates a WebGL tile layer for a Cloud Optimised GeoTIFF dataset.
 *
 * @param {object} dataset Dataset definition with a cog source
 * @param {string} layerId Map layer id
 * @returns {Promise<WebGLTileLayer>}
 */
export async function createCogLayer (dataset, layerId) {
  const { url, opacity, styleConfig, normalize, interpolate } = dataset.source

  validateStyleConfig(styleConfig, dataset.id)

  return new WebGLTileLayer({
    properties: { id: layerId },
    source: new GeoTIFF({ sources: [{ url }], normalize, interpolate }),
    style: { color: cogColorFor(styleConfig) },
    opacity
  })
}

/**
 * Creates the permanent COG underlay for a FlatGeobuf detail layer.
 *
 * @param {object} overview Overview definition with a cog url
 * @param {string} layerId Map layer id
 * @param {object} options
 * @param {object} options.styleConfig Style config
 * @param {string} options.className Shared WebGL canvas class
 * @returns {Promise<WebGLTileLayer>}
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

  await waitForMetadata(source)

  return new WebGLTileLayer({
    properties: { id: layerId },
    source,
    style: { color: cogColorFor(styleConfig) },
    opacity: 1,
    className,
    // Load every ancestor tile so OL can stretch one over gaps during movement.
    preload: Infinity
  })
}
