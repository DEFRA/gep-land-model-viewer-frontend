import { readFileSync } from 'node:fs'
import { describe, test, expect, vi, afterEach } from 'vitest'

vi.mock('geotiff', () => ({ fromUrl: vi.fn() }))

const { fromUrl } = await import('geotiff')
const actualGeotiff = await vi.importActual('geotiff')
const { readCellValues } = await import('./cell-values.js')

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
    vi.stubGlobal('fetch', vi.fn(async (_url, { headers }) => {
      const [start, end] = /bytes=(\d+)-(\d+)/.exec(headers.Range).slice(1).map(Number)
      const bytes = IDS.slice(start, end + 1)
      return new Response(bytes, { status: 206, headers: { 'Content-Range': `bytes ${start}-${start + bytes.length - 1}/${IDS.length}` } })
    }))
    fromUrl.mockImplementation(actualGeotiff.fromUrl)

    await expect(readCellValues('/ids.tif', [10, 20, 20, 30])).resolves.toEqual([16777219])
  })
})
