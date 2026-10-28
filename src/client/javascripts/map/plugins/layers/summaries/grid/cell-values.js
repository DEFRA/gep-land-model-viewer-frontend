import { fromUrl } from 'geotiff'
import { containsExtent } from 'ol/extent.js'

/** @type {Map<string, ReturnType<typeof fromUrl>>} */
const cogs = new Map()

/** @param {string} url */
function openCog (url) {
  if (!cogs.has(url)) {
    cogs.set(url, fromUrl(url))
  }

  return cogs.get(url)
}

/**
 * Reads a cell's pixel from a COG's full-resolution image. The layer's
 * getData() isn't used as it can return an overview just after a zoom, and
 * rounds IDs above 16,777,216 as it stores bands as Float32.
 *
 * @param {string} url The COG's URL
 * @param {import('ol/extent.js').Extent} extent The cell's bounds, matching one pixel
 * @returns {Promise<number[] | null>} The pixel's band values, first band first, or null outside the COG or
 * where it has no cell
 */
export async function readCellValues (url, extent) {
  const opening = openCog(url)
  try {
    const cog = await opening
    const image = await cog.getImage()
    if (!containsExtent(image.getBoundingBox(), extent)) {
      return null
    }

    const pixel = /** @type {ArrayLike<number>} */ (await cog.readRasters({ bbox: extent, interleave: true }))
    const values = Array.from(pixel)
    // a pixel with no cell, such as the sea within the COG's bounds, is nodata (0) in every band
    return values.every(value => value === 0) ? null : values
  } catch (error) {
    // geotiff keeps failed requests, so open the COG again next time
    if (cogs.get(url) === opening) {
      cogs.delete(url)
    }

    throw error
  }
}
