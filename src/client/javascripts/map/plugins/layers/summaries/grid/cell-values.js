import { fromUrl } from 'geotiff'
import { containsExtent, getIntersection, isEmpty } from 'ol/extent.js'

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
  return readCog(url, async (cog) => {
    const image = await cog.getImage()
    if (!containsExtent(image.getBoundingBox(), extent)) {
      return null
    }

    const pixel = /** @type {ArrayLike<number>} */ (await cog.readRasters({ bbox: extent, interleave: true }))
    return cellValues(Array.from(pixel))
  })
}

/**
 * Read many cells' pixels from a COG in one request.
 *
 * @param {string} url The COG's URL
 * @param {import('ol/extent.js').Extent} extent The cells' bounds, on pixel edges
 * @returns {Promise<(cellExtent: import('ol/extent.js').Extent) => number[] | null>}
 */
export async function readCellsValues (url, extent) {
  return readCog(url, async (cog) => {
    const image = await cog.getImage()
    const bounds = getIntersection(image.getBoundingBox(), extent)
    if (isEmpty(bounds)) {
      return () => null
    }

    const [originX, originY] = image.getOrigin()
    const [resolutionX, resolutionY] = image.getResolution()
    const column = x => Math.round((x - originX) / resolutionX)
    const row = y => Math.round((originY - y) / -resolutionY)
    const left = column(bounds[0])
    const top = row(bounds[3])
    const bandCount = image.getSamplesPerPixel()
    const pixels = /** @type {import('geotiff').TypedArray & { width: number }} */ (
      await image.readRasters({ window: [left, top, column(bounds[2]), row(bounds[1])], interleave: true })
    )

    return (cellExtent) => {
      if (!containsExtent(bounds, cellExtent)) {
        return null
      }

      const offset = ((row(cellExtent[3]) - top) * pixels.width + column(cellExtent[0]) - left) * bandCount
      return cellValues(Array.from(pixels.subarray(offset, offset + bandCount)))
    }
  })
}

/**
 * @param {number[]} values A pixel's band values
 * @returns {number[] | null}
 */
function cellValues (values) {
  // a pixel with no cell, such as the sea within the COG's bounds, is nodata (0) in every band
  return values.every(value => value === 0) ? null : values
}

/**
 * @template T
 * @param {string} url The COG's URL
 * @param {(cog: Awaited<ReturnType<typeof fromUrl>>) => Promise<T>} read
 * @returns {Promise<T>}
 */
async function readCog (url, read) {
  const opening = openCog(url)
  try {
    return await read(await opening)
  } catch (error) {
    // geotiff keeps failed requests, so open the COG again next time
    if (cogs.get(url) === opening) {
      cogs.delete(url)
    }

    throw error
  }
}
