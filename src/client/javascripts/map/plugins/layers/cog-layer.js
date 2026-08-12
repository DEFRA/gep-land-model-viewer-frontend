import GeoTIFF from 'ol/source/GeoTIFF.js'
import WebGLTileLayer from 'ol/layer/WebGLTile.js'

/**
 * Creates a WebGL tile layer for a Cloud Optimised GeoTIFF dataset.
 *
 * @param {object} dataset Dataset definition with a cog source
 * @param {string} layerId Map layer id
 * @returns {Promise<WebGLTileLayer>}
 */
export async function createCogLayer (dataset, layerId) {
  const { url, opacity, style, normalize, interpolate } = dataset.source

  return new WebGLTileLayer({
    properties: { id: layerId },
    source: new GeoTIFF({ sources: [{ url }], normalize, interpolate }),
    style: { color: style.color },
    opacity
  })
}
