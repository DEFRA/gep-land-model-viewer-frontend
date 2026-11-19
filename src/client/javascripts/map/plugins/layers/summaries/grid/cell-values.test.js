import { readFileSync } from 'node:fs'
import { describe, test, expect, vi, afterEach } from 'vitest'

vi.mock('geotiff', () => ({ fromUrl: vi.fn() }))

const { fromUrl } = await import('geotiff')
const actualGeotiff = await vi.importActual('geotiff')
const { readCellValues, readCellsValues } = await import('./cell-values.js')

// A 4x4 COG of 10m UInt32 pixels from 0,0, all 16777217 except 16777219 in the
// second row and column, with a 2x2 MODE overview. Made from an ASCII grid with:
// gdal_translate -of COG -ot UInt32 -co COMPRESS=DEFLATE -co OVERVIEW_COUNT=1 -co OVERVIEW_RESAMPLING=MODE ids.asc ids.tif
const IDS = new Uint8Array(readFileSync(new URL('./test-helpers/ids.tif', import.meta.url)))

// A 40m square COG with 10m pixels
function cog (values) {
  return {
    getImage: async () => ({ getBoundingBox: () => [0, 0, 40, 40] }),
    readRasters: vi.fn(async () => new Uint32Array(values))
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('#readCellValues', () => {
  test('reads every band of the cell\'s pixel', async () => {
    const file = cog([7, 3])
    fromUrl.mockResolvedValue(file)

    await expect(readCellValues('/reads.tif', [30, 20, 40, 30])).resolves.toEqual([7, 3])
    expect(fromUrl).toHaveBeenCalledWith('/reads.tif')
    expect(file.readRasters).toHaveBeenCalledWith({ bbox: [30, 20, 40, 30], interleave: true })
  })

  test('returns null beyond the COG', async () => {
    const file = cog([7, 8])
    fromUrl.mockResolvedValue(file)

    await expect(readCellValues('/beyond.tif', [40, 20, 50, 30])).resolves.toBeNull()
    expect(file.readRasters).not.toHaveBeenCalled()
  })

  test('returns null for a pixel with no cell', async () => {
    fromUrl.mockResolvedValue(cog([0, 0]))

    await expect(readCellValues('/empty.tif', [30, 20, 40, 30])).resolves.toBeNull()
  })

  test('reads a pixel with some bands empty', async () => {
    fromUrl.mockResolvedValue(cog([7, 0]))

    await expect(readCellValues('/partial.tif', [30, 20, 40, 30])).resolves.toEqual([7, 0])
  })

  test('opens each COG once', async () => {
    fromUrl.mockClear()
    fromUrl.mockResolvedValue(cog([7, 8]))

    await readCellValues('/once.tif', [0, 30, 10, 40])
    await readCellValues('/once.tif', [10, 30, 20, 40])

    expect(fromUrl).toHaveBeenCalledOnce()
  })

  test('opens a COG again after it failed to open', async () => {
    const error = new Error('Request failed')
    fromUrl.mockRejectedValueOnce(error).mockResolvedValue(cog([7, 8]))

    await expect(readCellValues('/retry.tif', [0, 30, 10, 40])).rejects.toBe(error)
    await expect(readCellValues('/retry.tif', [0, 30, 10, 40])).resolves.toEqual([7, 8])
  })

  test('opens a COG again after reading it failed', async () => {
    const error = new Error('Request failed')
    const failed = { getImage: vi.fn(async () => { throw error }) }
    fromUrl.mockClear()
    fromUrl.mockResolvedValueOnce(failed).mockResolvedValue(cog([7, 8]))

    await expect(readCellValues('/reread.tif', [0, 30, 10, 40])).rejects.toBe(error)
    await expect(readCellValues('/reread.tif', [0, 30, 10, 40])).resolves.toEqual([7, 8])
    expect(fromUrl).toHaveBeenCalledTimes(2)
  })

  test('reads the exact value from the full-resolution image', async () => {
    serveIds()

    await expect(readCellValues('/ids.tif', [10, 20, 20, 30])).resolves.toEqual([16777219])
  })
})

// Serves the ids.tif fixture's bytes
function serveIds () {
  vi.stubGlobal('fetch', vi.fn(async (_url, { headers }) => {
    const [start, end] = /bytes=(\d+)-(\d+)/.exec(headers.Range).slice(1).map(Number)
    const bytes = IDS.slice(start, end + 1)
    return new Response(bytes, { status: 206, headers: { 'Content-Range': `bytes ${start}-${start + bytes.length - 1}/${IDS.length}` } })
  }))
  fromUrl.mockImplementation(actualGeotiff.fromUrl)
}

// A 40m square COG of 10m pixels with two bands and a nodata east column, read row by row with bands interleaved
function windowCog () {
  const pixel = (column, row) => column === 3 ? [0, 0] : [row * 4 + column + 1, 100 + row * 4 + column + 1]
  const image = {
    getBoundingBox: () => [0, 0, 40, 40],
    getOrigin: () => [0, 40],
    getResolution: () => [10, -10],
    getSamplesPerPixel: () => 2,
    readRasters: vi.fn(async ({ window: [left, top, right, bottom] }) => {
      const values = []
      for (let row = top; row < bottom; row++) {
        for (let column = left; column < right; column++) {
          values.push(...pixel(column, row))
        }
      }

      return Object.assign(new Uint32Array(values), { width: right - left })
    })
  }
  return { image, getImage: async () => image }
}

describe('#readCellsValues', () => {
  test('reads each cell\'s exact value from the full-resolution image', async () => {
    serveIds()

    const valuesAt = await readCellsValues('/ids-many.tif', [0, 10, 30, 40])

    expect(valuesAt([10, 20, 20, 30])).toEqual([16777219])
    expect(valuesAt([0, 30, 10, 40])).toEqual([16777217])
    expect(valuesAt([20, 10, 30, 20])).toEqual([16777217])
  })

  test('reads each cell\'s bands from a window several pixels wide and tall', async () => {
    const file = windowCog()
    fromUrl.mockResolvedValue(file)

    const valuesAt = await readCellsValues('/rows.tif', [10, 0, 30, 30])

    expect(file.image.readRasters).toHaveBeenCalledWith({ window: [1, 1, 3, 4], interleave: true })
    expect(valuesAt([10, 20, 20, 30])).toEqual([6, 106])
    expect(valuesAt([20, 10, 30, 20])).toEqual([11, 111])
    expect(valuesAt([20, 0, 30, 10])).toEqual([15, 115])
  })

  test('reads the window of the extent within the COG', async () => {
    const file = windowCog()
    fromUrl.mockResolvedValue(file)

    const valuesAt = await readCellsValues('/window.tif', [20, 30, 50, 50])

    expect(file.image.readRasters).toHaveBeenCalledWith({ window: [2, 0, 4, 1], interleave: true })
    expect(valuesAt([20, 30, 30, 40])).toEqual([3, 103])
    expect(valuesAt([30, 30, 40, 40])).toBeNull()
    expect(valuesAt([40, 40, 50, 50])).toBeNull()
    expect(valuesAt([0, 0, 10, 10])).toBeNull()
  })

  test('reads nothing for an extent beyond the COG', async () => {
    const file = windowCog()
    fromUrl.mockResolvedValue(file)

    const valuesAt = await readCellsValues('/beyond-many.tif', [50, 50, 70, 70])

    expect(file.image.readRasters).not.toHaveBeenCalled()
    expect(valuesAt([50, 50, 60, 60])).toBeNull()
  })

  test('opens a COG again after reading it failed', async () => {
    const error = new Error('Request failed')
    fromUrl.mockClear()
    fromUrl.mockResolvedValueOnce({ getImage: vi.fn(async () => { throw error }) }).mockResolvedValue(windowCog())

    await expect(readCellsValues('/reread-many.tif', [0, 30, 10, 40])).rejects.toBe(error)
    const valuesAt = await readCellsValues('/reread-many.tif', [0, 30, 10, 40])

    expect(valuesAt([0, 30, 10, 40])).toEqual([1, 101])
    expect(fromUrl).toHaveBeenCalledTimes(2)
  })
})
