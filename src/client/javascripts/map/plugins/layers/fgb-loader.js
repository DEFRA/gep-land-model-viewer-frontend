import { getDifference, intersects } from 'ol/extent.js'
import { deserialize } from 'flatgeobuf/lib/mjs/ol.js'
import { EPSG_27700 } from './constants.js'

/**
 * @typedef {object} FgbLoadController
 * @property {import('ol/featureloader.js').FeatureLoader} loader
 * @property {(extent: import('ol/extent.js').Extent) => boolean} retryFailedExtents
 */

// Yield after roughly half a 60 Hz frame so input and rendering get a turn.
const LOAD_TIME_SLICE_MS = 8

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
  const stream = deserialize(url, rect, undefined, nocache, headers, false, dataProjection, featureProjection)
  return /** @type {AsyncGenerator<import('ol/Feature.js').default>} */ (stream)
}

function removeExtentFromFailures (failures, extent) {
  return failures.flatMap((failure) => getDifference(failure.extent, extent)
    .map((remainder) => ({ extent: remainder, retryGranted: failure.retryGranted })))
}

/**
 * Creates a yielding FlatGeobuf loader with failed-extent recovery.
 *
 * The stock loader adds each feature separately, repeatedly invalidating the
 * WebGL source while it decodes. Returning one batch avoids those buffer
 * rebuilds, yielding during decode keeps the map responsive.
 *
 * Failed extents stay counted as loaded, so a failure cannot redraw itself
 * into a request loop. Each user action grants one retry; a retry that
 * fails is eligible again on the next user action.
 *
 * @param {import('ol/source/Vector.js').default} source
 * @param {string} url
 * @param {import('ol/layer/WebGLVector.js').default} detailLayer
 * @returns {FgbLoadController}
 */
export function createFgbLoadController (source, url, detailLayer) {
  /** @type {{extent: import('ol/extent.js').Extent, retryGranted: boolean}[]} */
  let failures = []

  function recordFailure (extent) {
    failures = removeExtentFromFailures(failures, extent)
    failures.push({ extent: extent.slice(), retryGranted: false })
  }

  function recordSuccess (extent) {
    failures = removeExtentFromFailures(failures, extent)
  }

  async function loader (extent, _resolution, projection) {
    const [minX, minY, maxX, maxY] = extent
    /** @type {import('ol/Feature.js').default[]} */
    const features = []
    let sliceStarted = performance.now()

    try {
      const stream = deserializeFgb(url, { minX, minY, maxX, maxY }, {
        dataProjection: EPSG_27700,
        featureProjection: projection.getCode()
      })

      for await (const feature of stream) {
        features.push(feature)

        if (performance.now() - sliceStarted >= LOAD_TIME_SLICE_MS) {
          await yieldToMain()
          sliceStarted = performance.now()
        }
      }
    } catch (error) {
      recordFailure(extent)
      throw error
    }

    // Resolving triggers addFeatures and a buffer build, the renderers
    // single ready flag cannot cover two builds, wait out any in-flight one.
    await waitForRenderer(detailLayer)
    recordSuccess(extent)

    return features
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

  return { loader, retryFailedExtents }
}
