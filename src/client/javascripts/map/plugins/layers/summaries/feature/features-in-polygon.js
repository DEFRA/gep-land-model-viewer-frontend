import booleanIntersects from '@turf/boolean-intersects'
import { deserialize } from 'flatgeobuf/lib/mjs/ol.js'
import GeoJSON from 'ol/format/GeoJSON.js'

const geoJson = new GeoJSON()

/**
 * Filters features to those that intersect the polygon.
 *
 * @param {import('ol/geom/Polygon.js').default} polygon
 * @param {import('ol/Feature.js').default[]} features
 * @returns {import('ol/Feature.js').default[]}
 */
export function featuresIntersecting (polygon, features) {
  const area = geoJson.writeGeometryObject(polygon)
  return features.filter(feature => booleanIntersects(area, geoJson.writeGeometryObject(feature.getGeometry())))
}

/**
 * Reads a FlatGeobuf's features within an extent from the file, rather than
 * from the map, which only keeps features in view.
 *
 * @param {string} url FlatGeobuf in the map's projection
 * @param {import('ol/extent.js').Extent} extent
 * @param {{ signal: AbortSignal }} options
 * @returns {Promise<import('ol/Feature.js').default[]>}
 */
export async function readFeaturesInExtent (url, [minX, minY, maxX, maxY], { signal }) {
  const features = []
  for await (const feature of deserialize(url, { rect: { minX, minY, maxX, maxY } })) {
    signal.throwIfAborted()
    features.push(/** @type {import('ol/Feature.js').default} */ (feature))
  }

  return features
}
