import GeoJSON from 'ol/format/GeoJSON.js'
import { deserialize } from 'flatgeobuf/lib/mjs/geojson.js'
import { isCoarsePointer } from '../../../../pointer.js'

// Escalating search boxes in pixels: the detailed polygon can sit slightly
// off the generalised overview drawing. Touch gets wider boxes.
const FINE_POINTER_TOLERANCES = [3, 8, 16]
const COARSE_POINTER_TOLERANCES = [8, 16, 28]
const MIN_MAP_TOLERANCE = 0.5
const CANDIDATE_CAP = 120

const format = new GeoJSON()

function searchPixelTolerances () {
  return isCoarsePointer() ? COARSE_POINTER_TOLERANCES : FINE_POINTER_TOLERANCES
}

/**
 * Finds the FlatGeobuf feature under a clicked point by streaming a small
 * window of the file over HTTP range requests. A feature containing the
 * point wins, otherwise the nearest one within the search tolerance.
 *
 * @param {string} url FlatGeobuf file URL, same CRS as the coordinate
 * @param {number[]} coordinate Clicked map coordinate
 * @param {number} resolution Current view resolution in map units per pixel
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<object | null>} The matching GeoJSON feature, or null
 */
export async function queryFgbNearPoint (url, coordinate, resolution, { signal } = {}) {
  const [x, y] = coordinate
  let nearest = null
  let nearestDistanceSquared = Infinity

  for (const pixels of searchPixelTolerances()) {
    signal?.throwIfAborted()
    const tolerance = Math.max(MIN_MAP_TOLERANCE, pixels * resolution)
    const rect = { minX: x - tolerance, minY: y - tolerance, maxX: x + tolerance, maxY: y + tolerance }
    const scan = await scanForMatch(url, rect, coordinate, signal)
    if (scan.contained) {
      return scan.contained
    }

    if (scan.nearestDistanceSquared < nearestDistanceSquared) {
      nearest = scan.nearest
      nearestDistanceSquared = scan.nearestDistanceSquared
    }

    if (nearest && nearestDistanceSquared <= tolerance * tolerance) {
      return nearest
    }
  }

  return null
}

async function scanForMatch (url, rect, coordinate, signal) {
  let nearest = null
  let nearestDistanceSquared = Infinity
  let count = 0

  for await (const feature of deserialize(url, rect)) {
    signal?.throwIfAborted()
    const geometry = format.readGeometry(feature.geometry)
    if (geometry.intersectsCoordinate(coordinate)) {
      return { contained: feature }
    } else {
      const closest = geometry.getClosestPoint(coordinate)
      const distanceSquared = (closest[0] - coordinate[0]) ** 2 + (closest[1] - coordinate[1]) ** 2
      if (distanceSquared < nearestDistanceSquared) {
        nearest = feature
        nearestDistanceSquared = distanceSquared
      }
    }

    count += 1
    if (count >= CANDIDATE_CAP) {
      break
    }
  }

  return { contained: null, nearest, nearestDistanceSquared }
}
