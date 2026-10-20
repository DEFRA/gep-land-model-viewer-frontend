import { readFileSync } from 'node:fs'
import { describe, test, expect, vi, afterEach } from 'vitest'
import { HttpReader } from 'flatgeobuf/lib/mjs/http-reader.js'
import { readCellProperties } from './cell-properties.js'

const BLOCK_SIZE = 16 * 1024

// 25 1km cell centres from SE6473 to SE6877, cut from the dev grid with:
// ogr2ogr -f FlatGeobuf -lco SPATIAL_INDEX=YES -nln cells -select bng_ref -spat 464000 473000 469000 478000 cells.fgb compose/garage/data/land-model/grid/1000.fgb
const CELLS = new Uint8Array(readFileSync(new URL('./test-helpers/cells.fgb', import.meta.url)))

// The 1km cell SE6675
const EXTENT = [466000, 475000, 467000, 476000]

// Answers range requests from the file's bytes, as S3 does
function serve (file) {
  vi.stubGlobal('fetch', vi.fn(async (_url, { headers }) => {
    const [start, end] = /bytes=(\d+)-(\d+)/.exec(headers.Range).slice(1).map(Number)
    if (start >= file.length) {
      return { ok: false, status: 416 }
    }

    const bytes = file.slice(start, end + 1)
    return { ok: true, status: 206, arrayBuffer: async () => bytes.buffer }
  }))
}

// The range client readCellProperties opens the file with
async function rangeClientFor (url) {
  const openSource = vi.spyOn(HttpReader, 'openSource').mockResolvedValueOnce({ selectBbox: async function * () {} })
  await readCellProperties(url, 'SE6675', EXTENT)
  return openSource.mock.lastCall[0]
}

async function read (client, begin, length) {
  return new Uint8Array(await client.getRange(begin, length, 'test'))
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('#readCellProperties', () => {
  test('returns the properties of the cell whose reference matches', async () => {
    serve(CELLS)

    await expect(readCellProperties('/centre.fgb', 'SE6675', EXTENT)).resolves.toEqual({ bng_ref: 'SE6675' })
  })

  test('returns null when the FGB has no point for the cell', async () => {
    serve(CELLS)

    await expect(readCellProperties('/missing.fgb', 'SE6070', [460000, 470000, 461000, 471000])).resolves.toBeNull()
  })

  test('returns null when the FGB\'s points are for another cell size', async () => {
    serve(CELLS)

    await expect(readCellProperties('/other-size.fgb', 'SE67', [460000, 470000, 470000, 480000])).resolves.toBeNull()
  })

  test('reads each file\'s blocks separately', async () => {
    serve(CELLS)

    await readCellProperties('/one.fgb', 'SE6675', EXTENT)
    await readCellProperties('/two.fgb', 'SE6675', EXTENT)

    expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/one.fgb', '/two.fgb'])
  })

  test('answers a nearby lookup from the blocks an earlier one read', async () => {
    serve(CELLS)

    await expect(readCellProperties('/cells.fgb', 'SE6675', EXTENT)).resolves.toEqual({ bng_ref: 'SE6675' })
    await expect(readCellProperties('/cells.fgb', 'SE6776', [467000, 476000, 468000, 477000])).resolves.toEqual({ bng_ref: 'SE6776' })
    expect(fetch).toHaveBeenCalledOnce()
  })
})

describe('range client', () => {
  // Random, so bytes read from the wrong offset don't match
  const FILE = crypto.getRandomValues(new Uint8Array(40000))

  test('reads whole blocks and answers later reads in them from memory', async () => {
    serve(FILE)
    const client = await rangeClientFor('/blocks.fgb')

    expect(await read(client, 100, 8)).toEqual(FILE.slice(100, 108))
    expect(await read(client, 16000, 300)).toEqual(FILE.slice(16000, 16300))
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith('/blocks.fgb', { headers: { Range: 'bytes=0-16383' } })
  })

  test('fetches the blocks a read is missing in one request', async () => {
    serve(FILE)
    const client = await rangeClientFor('/span.fgb')

    await read(client, 0, 8)

    expect(await read(client, 16000, 20000)).toEqual(FILE.slice(16000, 36000))
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch).toHaveBeenLastCalledWith('/span.fgb', { headers: { Range: 'bytes=16384-49151' } })
  })

  test('stops at the end of the file', async () => {
    serve(FILE)
    const client = await rangeClientFor('/end.fgb')

    expect(await read(client, 39990, 100)).toEqual(FILE.slice(39990))
  })

  test('returns the bytes up to the end of the file when its last block is already cached', async () => {
    serve(FILE)
    const client = await rangeClientFor('/cached-end.fgb')
    await read(client, 39990, 1)

    expect(await read(client, 39990, 10000)).toEqual(FILE.slice(39990))
    expect(fetch).toHaveBeenLastCalledWith('/cached-end.fgb', { headers: { Range: 'bytes=49152-65535' } })
  })

  test('reads a block again after a failed request', async () => {
    serve(FILE)
    fetch.mockResolvedValueOnce({ ok: false, status: 502 })
    const client = await rangeClientFor('/retry.fgb')

    await expect(read(client, 0, 8)).rejects.toThrow('Failed to read grid FGB (502)')
    expect(await read(client, 0, 8)).toEqual(FILE.slice(0, 8))
  })

  test('keeps a cached block between missing ones when their request fails', async () => {
    serve(FILE)
    const client = await rangeClientFor('/between.fgb')
    await read(client, BLOCK_SIZE, 1)
    fetch.mockResolvedValueOnce({ ok: false, status: 502 })

    await expect(read(client, 0, FILE.length)).rejects.toThrow('Failed to read grid FGB (502)')
    expect(fetch).toHaveBeenLastCalledWith('/between.fgb', { headers: { Range: 'bytes=0-49151' } })

    fetch.mockClear()
    expect(await read(client, BLOCK_SIZE, 8)).toEqual(FILE.slice(BLOCK_SIZE, BLOCK_SIZE + 8))
    expect(fetch).not.toHaveBeenCalled()
  })

  test('keeps the 256 most recently used blocks', async () => {
    serve(new Uint8Array(257 * BLOCK_SIZE))
    const client = await rangeClientFor('/recent.fgb')
    for (let block = 0; block <= 256; block++) {
      await read(client, block * BLOCK_SIZE, 1)
    }
    fetch.mockClear()

    await read(client, BLOCK_SIZE, 1)
    expect(fetch).not.toHaveBeenCalled()

    await read(client, 0, 1)
    expect(fetch).toHaveBeenCalledOnce()
  })
})
