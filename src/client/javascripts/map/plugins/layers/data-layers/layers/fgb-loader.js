import TileGrid from 'ol/tilegrid/TileGrid.js'
import { buffer, extend, getDifference, intersects } from 'ol/extent.js'
import { fromKey, getKey } from 'ol/tilecoord.js'
import { deserialize } from 'flatgeobuf/lib/mjs/ol.js'
import { EPSG_27700 } from '../../constants.js'
import { vectorStyleProperties } from '../style-config.js'

/**
 * @typedef {object} FgbLoadController
 * @property {(extent: import('ol/extent.js').Extent) => import('ol/extent.js').Extent[]} strategy
 * @property {import('ol/featureloader.js').FeatureLoader} loader
 * @property {(extent: import('ol/extent.js').Extent) => boolean} retryFailedExtents
 * @property {(extent: import('ol/extent.js').Extent) => Promise<void>} setViewExtent
 * @property {(styleConfig: object) => void} setStyleConfig
 */

// Yield after roughly half a 60 Hz frame so input and rendering get a turn.
const LOAD_TIME_SLICE_MS = 8

// One box size at every zoom, sized for parcels as the densest dataset.
// Zoomed in, data loads a box at a time and at most a few km2 stays loaded.
// At zoom 7, loading reaches only a little past the view's edges.
const BOX_SIZE_METRES = 1000
const BOX_GRID = new TileGrid({ origin: [0, 0], resolutions: [1], tileSize: BOX_SIZE_METRES })

/**
 * @param {import('ol/extent.js').Extent} extent
 * @returns {string[]} Keys of the boxes covering extent
 */
function boxesIn (extent) {
  const keys = []
  BOX_GRID.forEachTileCoord(extent, 0, (tileCoord) => {
    keys.push(getKey(tileCoord))
  })
  return keys
}

/**
 * Merges neighbouring boxes into as few rectangles as possible.
 *
 * @param {import('ol/tilecoord.js').TileCoord[]} tileCoords
 * @returns {import('ol/extent.js').Extent[]}
 */
function mergeBoxes (tileCoords) {
  const columnsByRow = new Map()
  for (const [, x, y] of tileCoords) {
    if (!columnsByRow.has(y)) {
      columnsByRow.set(y, [])
    }
    columnsByRow.get(y).push(x)
  }

  const runs = []
  for (const [y, columns] of columnsByRow) {
    columns.sort((a, b) => a - b)
    let start = columns[0]
    for (let i = 1; i <= columns.length; i++) {
      if (columns[i] !== columns[i - 1] + 1) {
        runs.push({ y, start, end: columns[i - 1] })
        start = columns[i]
      }
    }
  }

  // Sorted so runs spanning the same columns sit together by row, a run in
  // the row below the last rectangle extends it, any other starts a new one.
  runs.sort((a, b) => a.start - b.start || a.end - b.end || a.y - b.y)
  const rectangles = []
  for (const run of runs) {
    const last = rectangles.at(-1)
    if (last?.start === run.start && last.end === run.end && last.lastY + 1 === run.y) {
      last.lastY = run.y
    } else {
      rectangles.push({ ...run, lastY: run.y })
    }
  }

  return rectangles.map(({ start, end, y, lastY }) => extend(
    BOX_GRID.getTileCoordExtent([0, start, y]),
    BOX_GRID.getTileCoordExtent([0, end, lastY])
  ))
}

function yieldToMain () {
  if (typeof globalThis.scheduler?.yield === 'function') {
    return globalThis.scheduler.yield()
  }

  return new Promise((resolve) => setTimeout(resolve))
}

function waitForRenderer (detailLayer) {
  const renderer = detailLayer.getRenderer()
  if (renderer?.ready !== false) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const onChange = () => {
      if (renderer.ready === false) {
        return
      }

      detailLayer.un('change', onChange)
      resolve()
    }

    detailLayer.on('change', onChange)
  })
}

/**
 * @param {string} url
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} rect
 * @param {{nocache?: boolean, headers?: HeadersInit, dataProjection?: string, featureProjection?: string}} [options]
 * @returns {AsyncGenerator<import('ol/Feature.js').default>}
 */
function deserializeFgb (url, rect, { nocache, headers, dataProjection, featureProjection } = {}) {
  const stream = deserialize(url, { rect, nocache, headers, dataProjection, featureProjection })
  return /** @type {AsyncGenerator<import('ol/Feature.js').default>} */ (stream)
}

/**
 * Decodes the features over extent with their style properties set, yielding
 * to the main thread each time slice.
 *
 * @param {string} url
 * @param {import('ol/extent.js').Extent} extent
 * @param {import('ol/proj/Projection.js').default} projection
 * @param {object} styleConfig
 * @param {() => boolean} keepReading Checked after each yield
 * @returns {Promise<import('ol/Feature.js').default[] | null>} null once keepReading is false
 */
async function readFeatures (url, extent, projection, styleConfig, keepReading) {
  const [minX, minY, maxX, maxY] = extent
  const stream = deserializeFgb(url, { minX, minY, maxX, maxY }, {
    dataProjection: EPSG_27700,
    featureProjection: projection.getCode()
  })
  const features = []
  let sliceStarted = performance.now()

  for await (const feature of stream) {
    feature.setProperties(vectorStyleProperties(styleConfig, feature.get(styleConfig.field)), true)
    features.push(feature)

    if (performance.now() - sliceStarted < LOAD_TIME_SLICE_MS) {
      continue
    }

    await yieldToMain()
    sliceStarted = performance.now()

    if (!keepReading()) {
      return null
    }
  }

  return features
}

function removeExtentFromFailures (failures, extent) {
  return failures.flatMap((failure) => getDifference(failure.extent, extent)
    .map((remainder) => ({ extent: remainder, retryGranted: failure.retryGranted })))
}

/**
 * Creates a yielding FlatGeobuf loader that loads the view in boxes, with
 * failed-extent recovery and eviction of boxes away from the view.
 *
 * The stock loader adds each feature separately, repeatedly invalidating the
 * WebGL source while it decodes. Adding one batch avoids those buffer
 * rebuilds, yielding during decode keeps the map responsive.
 *
 * Failed extents stay counted as loaded, so a failure cannot redraw itself
 * into a request loop. Each user action grants one retry; a retry that
 * fails is eligible again on the next user action.
 *
 * @param {import('ol/source/Vector.js').default} source
 * @param {string} url
 * @param {import('ol/layer/WebGLVector.js').default} detailLayer
 * @param {object} styleConfig Style resolved onto each loaded feature
 * @returns {FgbLoadController}
 */
export function createFgbLoadController (source, url, detailLayer, styleConfig) {
  /** @type {{extent: import('ol/extent.js').Extent, retryGranted: boolean}[]} */
  let failures = []
  /** @type {Set<string>} */
  const loadedBoxes = new Set()
  /** @type {Set<string>} */
  const requestedBoxes = new Set()
  /** @type {import('ol/extent.js').Extent | undefined} */
  let viewExtent
  /** @type {Promise<void> | null} */
  let pendingEviction = null
  let styleVersion = 0

  function recordFailure (extent) {
    failures = removeExtentFromFailures(failures, extent)
    failures.push({ extent: extent.slice(), retryGranted: false })
  }

  function unmarkRequested (boxes) {
    for (const key of boxes) {
      requestedBoxes.delete(key)
    }
  }

  function keepRange () {
    return BOX_GRID.getTileRangeForExtentAndZ(buffer(viewExtent, BOX_SIZE_METRES), 0)
  }

  function inKeepRange (boxes) {
    if (!viewExtent) {
      return true
    }

    const keep = keepRange()
    return boxes.some((key) => keep.contains(fromKey(key)))
  }

  function cancelLoad (extent, boxes) {
    unmarkRequested(boxes)
    source.removeLoadedExtent(extent)
    scheduleEviction()
  }

  function recordSuccess (extent, boxes) {
    failures = removeExtentFromFailures(failures, extent)
    for (const key of boxes) {
      requestedBoxes.delete(key)
      loadedBoxes.add(key)
    }
  }

  /**
   * Returns the boxes over the extent not yet loaded or requested, merged into
   * as few requests as possible.
   *
   * @param {import('ol/extent.js').Extent} extent
   * @returns {import('ol/extent.js').Extent[]}
   */
  function strategy (extent) {
    const missing = boxesIn(extent).filter((key) => !loadedBoxes.has(key) && !requestedBoxes.has(key))
    return mergeBoxes(missing.map(fromKey))
  }

  async function loader (extent, _resolution, projection) {
    const loadStyleVersion = styleVersion
    const boxes = boxesIn(extent)
    for (const key of boxes) {
      requestedBoxes.add(key)
    }

    let features
    try {
      features = await readFeatures(url, extent, projection, styleConfig, () => inKeepRange(boxes))
    } catch (error) {
      if (loadStyleVersion !== styleVersion) {
        throw error
      }

      unmarkRequested(boxes)
      recordFailure(extent)
      scheduleEviction()
      throw error
    }

    if (loadStyleVersion !== styleVersion) {
      return [] // style change reloads the source, so this is out of date
    }

    if (!features || !inKeepRange(boxes)) {
      cancelLoad(extent, boxes)
      return []
    }

    // Adding starts a buffer build, the renderers single ready flag cannot
    // cover two builds, wait for any in-flight one.
    await waitForRenderer(detailLayer)

    if (loadStyleVersion !== styleVersion) {
      return []
    }

    if (!inKeepRange(boxes)) {
      cancelLoad(extent, boxes)
      return []
    }

    // Add here rather than returning for OL, so eviction never sees
    // a box before its features are in the source.
    source.addFeatures(features)
    recordSuccess(extent, boxes)
    scheduleEviction()

    return []
  }

  function retryFailedExtents (extent) {
    const retryable = failures.filter((failure) => !failure.retryGranted && intersects(failure.extent, extent))
    if (retryable.length === 0) {
      return false
    }

    for (const failure of retryable) {
      failure.retryGranted = true
      source.removeLoadedExtent(failure.extent)
    }
    source.changed()

    return true
  }

  function evictOutsideView () {
    if (!viewExtent) {
      return
    }

    const keep = keepRange()
    const candidates = new Set()
    for (const key of loadedBoxes) {
      const tileCoord = fromKey(key)
      if (keep.contains(tileCoord)) {
        continue
      }

      const extent = BOX_GRID.getTileCoordExtent(tileCoord)
      loadedBoxes.delete(key)
      // OpenLayers tracks loaded extents separately from features, so unmark
      // the extent to allow a reload, and remove the features below.
      source.removeLoadedExtent(extent)
      for (const feature of source.getFeaturesInExtent(extent)) {
        candidates.add(feature)
      }
    }

    // Features intersecting a retained box stay, everything else is removed.
    const kept = [...loadedBoxes].map((key) => BOX_GRID.getTileCoordExtent(fromKey(key)))
    const stale = [...candidates].filter((feature) => {
      const featureExtent = feature.getGeometry().getExtent()
      return !kept.some((extent) => intersects(extent, featureExtent))
    })

    source.removeFeatures(stale)
  }

  /**
   * Schedules eviction for when any in-progress buffer build finishes.
   * Calls made while it is pending share the same eviction.
   */
  function scheduleEviction () {
    pendingEviction ??= waitForRenderer(detailLayer).then(() => {
      pendingEviction = null
      evictOutsideView()
    })
  }

  /**
   * @param {import('ol/extent.js').Extent} extent
   * @returns {Promise<void>}
   */
  function setViewExtent (extent) {
    viewExtent = extent
    // Loads in flight schedule eviction as they settle, so a pan's eviction
    // and additions share one buffer build.
    if (requestedBoxes.size === 0) {
      scheduleEviction()
    }

    return pendingEviction ?? Promise.resolve()
  }

  function setStyleConfig (next) {
    styleConfig = next
    styleVersion++
    failures = []
    loadedBoxes.clear()
    requestedBoxes.clear()
    // Must reload to restyle features, their style properties are set as they load
    source.refresh()
  }

  return { strategy, loader, retryFailedExtents, setViewExtent, setStyleConfig }
}
