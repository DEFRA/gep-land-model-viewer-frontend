import { logExternalCall } from '../../../../authenticated-fetch.js'
import { parseProperties } from 'flatgeobuf/lib/mjs/generic.js'
import { HttpReader } from 'flatgeobuf/lib/mjs/http-reader.js'

/** @typedef {import('flatgeobuf/lib/mjs/http-reader.js').RangeClient} RangeClient */

// FGBs store their index and features in spatial order, so a block read for
// one cell usually holds its neighbours too.
const BLOCK_SIZE = 16 * 1024
const MAX_BLOCKS = 256

/**
 * @typedef {import('../land-model-properties.js').LandModelProperties & { bng_ref: string }} CellProperties
 * A coarse cell's properties in its FGB, with its compact British National Grid reference
 */

/**
 * @param {Uint8Array[]} blocks
 * @returns {Uint8Array}
 */
function concat (blocks) {
  const bytes = new Uint8Array(blocks.reduce((total, block) => total + block.length, 0))
  let offset = 0
  for (const block of blocks) {
    bytes.set(block, offset)
    offset += block.length
  }

  return bytes
}

/**
 * Fetches whole blocks and keeps the most recently used.
 *
 * @implements {RangeClient}
 */
class BlockCachedRangeClient {
  #url

  /** @type {Map<number, Promise<Uint8Array>>} Least recently used first */
  #blocks = new Map()

  /** @param {string} url */
  constructor (url) {
    this.#url = url
  }

  /**
   * Returns the range's bytes, cut short at the end of the file.
   *
   * @type {RangeClient['getRange']}
   */
  async getRange (begin, length) {
    const first = Math.floor(begin / BLOCK_SIZE)
    const last = Math.floor((begin + length - 1) / BLOCK_SIZE)
    const indexes = Array.from({ length: last - first + 1 }, (_, offset) => first + offset)
    const missing = indexes.filter(index => !this.#blocks.has(index))
    if (missing.length) {
      this.#fetchBlocks(missing)
    }

    const blocks = indexes.map(index => this.#use(index))
    this.#evict()

    const bytes = concat(await Promise.all(blocks))
    const start = begin - first * BLOCK_SIZE
    return bytes.slice(start, start + length).buffer
  }

  /**
   * Fetches the blocks in one request, leaving any cached blocks between them
   * as they are. Blocks from a failed request are dropped so the next read
   * retries them.
   *
   * @param {number[]} indexes In file order
   */
  #fetchBlocks (indexes) {
    const first = indexes[0]
    const span = this.#fetch(first * BLOCK_SIZE, (indexes.at(-1) - first + 1) * BLOCK_SIZE)
    for (const index of indexes) {
      const offset = (index - first) * BLOCK_SIZE
      this.#blocks.set(index, span.then(bytes => bytes.slice(offset, offset + BLOCK_SIZE)))
    }

    span.catch(() => {
      for (const index of indexes) {
        this.#blocks.delete(index)
      }
    })
  }

  /**
   * @param {number} begin
   * @param {number} length
   * @returns {Promise<Uint8Array>}
   */
  async #fetch (begin, length) {
    const response = await logExternalCall('FlatGeobuf', 'readGridProperties', () => fetch(this.#url, { headers: { Range: `bytes=${begin}-${begin + length - 1}` } }))
    // The request started past the end of the file
    if (response.status === 416) {
      return new Uint8Array(0)
    }

    if (!response.ok) {
      throw new Error(`Failed to read grid FGB (${response.status})`)
    }

    return new Uint8Array(await response.arrayBuffer())
  }

  /**
   * @param {number} index
   * @returns {Promise<Uint8Array>} The block, now the most recently used
   */
  #use (index) {
    const block = this.#blocks.get(index)
    this.#blocks.delete(index)
    this.#blocks.set(index, block)
    return block
  }

  #evict () {
    while (this.#blocks.size > MAX_BLOCKS) {
      this.#blocks.delete(this.#blocks.keys().next().value)
    }
  }
}

/** @type {Map<string, BlockCachedRangeClient>} */
const rangeClients = new Map()

/** @param {string} url */
function rangeClientFor (url) {
  if (!rangeClients.has(url)) {
    rangeClients.set(url, new BlockCachedRangeClient(url))
  }

  return rangeClients.get(url)
}

/**
 * Finds a cell's properties in a coarse grid FGB. The query covers the whole
 * cell and matches its reference, so the cell's point can sit anywhere in it
 * or on its edges.
 *
 * @param {string} url The FGB for the cell's size
 * @param {string} bngRef The cell's compact grid reference
 * @param {import('ol/extent.js').Extent} extent The cell's bounds
 * @returns {Promise<CellProperties | null>} null when the FGB has no point for the cell
 */
export async function readCellProperties (url, bngRef, [minX, minY, maxX, maxY]) {
  const reader = await HttpReader.openSource(rangeClientFor(url))
  for await (const { feature } of reader.selectBbox({ minX, minY, maxX, maxY })) {
    const properties = parseProperties(feature, reader.header.columns)
    if (properties.bng_ref === bngRef) {
      return /** @type {CellProperties} */ (properties)
    }
  }

  return null
}
