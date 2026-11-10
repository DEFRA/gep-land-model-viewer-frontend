import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('flatgeobuf/lib/mjs/ol.js', () => ({
  deserialize: vi.fn()
}))

const { default: Feature } = await import('ol/Feature.js')
const { default: VectorSource } = await import('ol/source/Vector.js')
const { fromExtent } = await import('ol/geom/Polygon.js')
const { deserialize } = await import('flatgeobuf/lib/mjs/ol.js')
const { createFgbLoadController } = await import('./fgb-loader.js')

const URL = '/land-model/vector/test.fgb'
const EXTENT = [100, 200, 300, 400]
const OTHER_EXTENT = [500, 600, 700, 800]
const projection = { getCode: () => 'EPSG:27700' }
const STYLE_CONFIG = {
  type: 'match',
  field: 'category',
  classes: [{ fieldValues: ['Arable'], fill: [1, 2, 3, 1], stroke: { color: [4, 5, 6, 1], width: 2 } }],
  default: { fill: [0, 0, 0, 0] }
}

async function * streamOf (features) {
  yield * features
}

async function * failingStream () {
  throw new Error('range request failed')
}

function detailHarness (ready = true) {
  const listeners = new Set()
  const renderer = { ready }
  let notifyListening
  const listening = new Promise((resolve) => { notifyListening = resolve })
  const layer = {
    getRenderer: vi.fn(() => renderer),
    on: vi.fn((type, listener) => {
      listeners.add(listener)
      notifyListening()
    }),
    un: vi.fn((type, listener) => listeners.delete(listener)),
    emitChange: () => {
      for (const listener of [...listeners]) {
        listener()
      }
    }
  }

  return { layer, renderer, listening }
}

function sourceHarness () {
  return {
    addFeatures: vi.fn(),
    removeFeatures: vi.fn(),
    getFeaturesInExtent: vi.fn(() => []),
    removeLoadedExtent: vi.fn(),
    changed: vi.fn(),
    refresh: vi.fn()
  }
}

function advancingClock (millisecondsPerRead) {
  let now = 0
  return vi.spyOn(performance, 'now').mockImplementation(() => {
    const current = now
    now += millisecondsPerRead
    return current
  })
}

describe('#createFgbLoadController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  test('adds the decoded features itself and resolves nothing for OpenLayers to add', async () => {
    const features = [new Feature({ id: 1 }), new Feature({ id: 2 }), new Feature({ id: 3 })]
    deserialize.mockReturnValueOnce(streamOf(features))
    const source = sourceHarness()
    const detail = detailHarness()
    const { loader } = createFgbLoadController(source, URL, detail.layer, STYLE_CONFIG)

    const loaded = loader(EXTENT, 10, projection)

    expect(loaded).toBeInstanceOf(Promise)
    await expect(loaded).resolves.toEqual([])
    expect(source.addFeatures).toHaveBeenCalledWith(features)
    expect(deserialize).toHaveBeenCalledWith(URL, {
      rect: { minX: 100, minY: 200, maxX: 300, maxY: 400 },
      dataProjection: 'EPSG:27700',
      featureProjection: 'EPSG:27700'
    })
  })

  test('uses scheduler.yield when decoding spends its time slice', async () => {
    deserialize.mockReturnValueOnce(streamOf([new Feature({ id: 1 }), new Feature({ id: 2 })]))
    const schedulerYield = vi.fn(() => Promise.resolve())
    vi.stubGlobal('scheduler', { yield: schedulerYield })
    advancingClock(8)
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    const detail = detailHarness()
    const { loader } = createFgbLoadController(sourceHarness(), URL, detail.layer, STYLE_CONFIG)

    await loader(EXTENT, 10, projection)

    expect(schedulerYield).toHaveBeenCalled()
    expect(setTimeoutSpy).not.toHaveBeenCalled()
  })

  test('falls back to a timer when scheduler.yield is unavailable', async () => {
    deserialize.mockReturnValueOnce(streamOf([new Feature({ id: 1 })]))
    vi.stubGlobal('scheduler', undefined)
    advancingClock(8)
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    const detail = detailHarness()
    const { loader } = createFgbLoadController(sourceHarness(), URL, detail.layer, STYLE_CONFIG)

    await loader(EXTENT, 10, projection)

    expect(setTimeoutSpy).toHaveBeenCalled()
  })

  test('does not yield while decoding stays inside the time slice', async () => {
    deserialize.mockReturnValueOnce(streamOf([new Feature({ id: 1 }), new Feature({ id: 2 })]))
    const schedulerYield = vi.fn(() => Promise.resolve())
    vi.stubGlobal('scheduler', { yield: schedulerYield })
    advancingClock(1)
    const detail = detailHarness()
    const { loader } = createFgbLoadController(sourceHarness(), URL, detail.layer, STYLE_CONFIG)

    await loader(EXTENT, 10, projection)

    expect(schedulerYield).not.toHaveBeenCalled()
  })

  test('waits for an older WebGL buffer build before completing an extent', async () => {
    const features = [new Feature({ id: 1 })]
    deserialize.mockReturnValueOnce(streamOf(features))
    const detail = detailHarness(false)
    const source = sourceHarness()
    const { loader } = createFgbLoadController(source, URL, detail.layer, STYLE_CONFIG)
    let completed = false

    const loaded = loader(EXTENT, 10, projection).then((result) => {
      completed = true
      return result
    })
    await detail.listening

    expect(completed).toBe(false)
    expect(source.addFeatures).not.toHaveBeenCalled()
    detail.renderer.ready = true
    detail.layer.emitChange()

    await loaded
    expect(source.addFeatures).toHaveBeenCalledWith(features)
    expect(detail.layer.un).toHaveBeenCalled()
  })

  test('resolves the style onto each feature from its style field', async () => {
    const feature = new Feature({ category: 'Arable' })
    deserialize.mockReturnValueOnce(streamOf([feature]))
    const { loader } = createFgbLoadController(sourceHarness(), URL, detailHarness().layer, STYLE_CONFIG)

    await loader(EXTENT, 10, projection)

    expect(feature.getProperties()).toEqual({
      category: 'Arable',
      styleFill: [1, 2, 3, 1],
      styleStroke: [4, 5, 6, 1],
      styleStrokeWidth: 2
    })
  })

  test('reloads the source to restyle with a new style config', async () => {
    const source = sourceHarness()
    const controller = createFgbLoadController(source, URL, detailHarness().layer, STYLE_CONFIG)
    const feature = new Feature({ category: 'Arable' })
    deserialize.mockReturnValueOnce(streamOf([feature]))

    controller.setStyleConfig({ ...STYLE_CONFIG, classes: [{ ...STYLE_CONFIG.classes[0], fill: [9, 9, 9, 1] }] })
    await controller.loader(EXTENT, 10, projection)

    expect(source.refresh).toHaveBeenCalledOnce()
    expect(feature.get('styleFill')).toEqual([9, 9, 9, 1])
  })

  test('a load finishing after a style change adds nothing', async () => {
    const source = sourceHarness()
    const detail = detailHarness(false)
    const controller = createFgbLoadController(source, URL, detail.layer, STYLE_CONFIG)
    deserialize.mockReturnValueOnce(streamOf([new Feature({ id: 1 })]))

    const loaded = controller.loader(EXTENT, 10, projection)
    await detail.listening
    controller.setStyleConfig(STYLE_CONFIG)
    detail.renderer.ready = true
    detail.layer.emitChange()

    await expect(loaded).resolves.toEqual([])
    expect(source.addFeatures).not.toHaveBeenCalled()

    await controller.setViewExtent([50_000, 50_000, 50_100, 50_100])
    expect(source.removeLoadedExtent).not.toHaveBeenCalled()
  })

  test('a load failing after a style change leaves the reload alone', async () => {
    let fail
    async function * failingLater () {
      await new Promise((resolve) => { fail = resolve })
      throw new Error('range request failed')
    }
    async function * neverEnding () {
      await new Promise(() => {})
    }
    deserialize.mockReturnValueOnce(failingLater()).mockReturnValueOnce(neverEnding())
    const controller = createFgbLoadController(sourceHarness(), URL, detailHarness().layer, STYLE_CONFIG)

    const stale = controller.loader(EXTENT, 10, projection)
    controller.setStyleConfig(STYLE_CONFIG)
    controller.loader(EXTENT, 10, projection)
    fail()
    await expect(stale).rejects.toThrow('range request failed')

    expect(controller.strategy(EXTENT)).toEqual([])
    expect(controller.retryFailedExtents(EXTENT)).toBe(false)
  })

  test('adds a completed extent as one batch', async () => {
    const features = Array.from({ length: 2001 }, (_, index) => new Feature({ index }))
    deserialize.mockReturnValueOnce(streamOf(features))
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const source = new VectorSource({ strategy: () => [EXTENT] })
    const detail = detailHarness()
    const addFeaturesSpy = vi.spyOn(source, 'addFeatures')
    const { loader } = createFgbLoadController(source, URL, detail.layer, STYLE_CONFIG)
    source.setLoader(loader)
    const ended = new Promise((resolve) => source.once('featuresloadend', resolve))

    source.loadFeatures(EXTENT, 10, projection)
    await ended

    expect(source.getFeatures()).toHaveLength(2001)
    expect(addFeaturesSpy).toHaveBeenCalledWith(features)
    expect(source.loading).toBe(0)
    source.dispose()
  })

  test('keeps failures quiet until the failed viewport is granted a retry', async () => {
    deserialize.mockImplementation(() => failingStream())
    const source = new VectorSource({ strategy: () => [EXTENT] })
    const detail = detailHarness()
    const controller = createFgbLoadController(source, URL, detail.layer, STYLE_CONFIG)
    source.setLoader(controller.loader)
    const firstFailure = new Promise((resolve) => source.once('featuresloaderror', resolve))
    let checkedFailureRedraw = false
    source.on('change', () => {
      if (!checkedFailureRedraw) {
        checkedFailureRedraw = true
        source.loadFeatures(EXTENT, 10, projection)
      }
    })

    source.loadFeatures(EXTENT, 10, projection)
    await firstFailure

    expect(checkedFailureRedraw).toBe(true)
    expect(deserialize).toHaveBeenCalledTimes(1)
    expect(controller.retryFailedExtents(OTHER_EXTENT)).toBe(false)
    expect(controller.retryFailedExtents(EXTENT)).toBe(true)
    expect(controller.retryFailedExtents(EXTENT)).toBe(false)

    const secondFailure = new Promise((resolve) => source.once('featuresloaderror', resolve))
    source.loadFeatures(EXTENT, 10, projection)
    await secondFailure

    source.loadFeatures(EXTENT, 10, projection)
    expect(deserialize).toHaveBeenCalledTimes(2)
    expect(controller.retryFailedExtents(EXTENT)).toBe(true)
    source.dispose()
  })

  test('a successful retry clears only the ground it loaded', async () => {
    deserialize
      .mockReturnValueOnce(failingStream())
      .mockReturnValueOnce(failingStream())
      .mockReturnValueOnce(streamOf([new Feature({ id: 1 })]))
    const source = sourceHarness()
    const detail = detailHarness()
    const controller = createFgbLoadController(source, URL, detail.layer, STYLE_CONFIG)

    await expect(controller.loader(EXTENT, 10, projection)).rejects.toThrow('range request failed')
    await expect(controller.loader(OTHER_EXTENT, 10, projection)).rejects.toThrow('range request failed')
    await controller.loader(OTHER_EXTENT, 10, projection)

    expect(controller.retryFailedExtents(EXTENT)).toBe(true)
    expect(controller.retryFailedExtents(OTHER_EXTENT)).toBe(false)
  })

  describe('boxes', () => {
    const ELSEWHERE = [50_000, 50_000, 50_100, 50_100]
    const NEAR_VIEW = [100, 100, 900, 900]
    const NEAR_BOX = [0, 0, 1000, 1000]
    const NEXT_BOX = [1000, 0, 2000, 1000]
    const FAR_BOX = [5000, 0, 6000, 1000]

    function featureOver (extent, id) {
      const feature = new Feature(fromExtent(extent))
      feature.setId(id)
      return feature
    }

    async function loadBox (controller, extent, features = []) {
      deserialize.mockReturnValueOnce(streamOf(features))
      await controller.loader(extent, 10, projection)
    }

    function heldStream (finish) {
      let release
      const released = new Promise((resolve) => { release = resolve })
      async function * stream () {
        await released
        yield * finish()
      }

      return { stream: stream(), release }
    }

    function harness () {
      const source = new VectorSource()
      const removeLoadedExtent = vi.spyOn(source, 'removeLoadedExtent')
      const detail = detailHarness()
      const controller = createFgbLoadController(source, URL, detail.layer, STYLE_CONFIG)
      return { source, removeLoadedExtent, detail, controller }
    }

    describe('strategy', () => {
      test('requests the boxes over an extent merged into one rectangle', () => {
        const { controller } = harness()

        expect(controller.strategy([100, 100, 2900, 1900])).toEqual([[0, 0, 3000, 2000]])
      })

      test('does not request boxes only touching the extent', () => {
        const { controller } = harness()

        expect(controller.strategy([0, 0, 1000, 1000])).toEqual([NEAR_BOX])
      })

      test('leaves out loaded and requested boxes', async () => {
        const { detail, controller } = harness()
        await loadBox(controller, NEAR_BOX)
        detail.renderer.ready = false
        deserialize.mockReturnValueOnce(streamOf([]))
        controller.loader(NEXT_BOX, 10, projection)

        expect(controller.strategy([100, 100, 2900, 900])).toEqual([[2000, 0, 3000, 1000]])
      })

      test('merges missing boxes into as few rectangles as rows allow', async () => {
        const { controller } = harness()
        await loadBox(controller, [1000, 1000, 2000, 2000])

        const rectangles = controller.strategy([100, 100, 1900, 1900])

        expect(rectangles).toHaveLength(2)
        expect(rectangles).toEqual(expect.arrayContaining([[0, 0, 2000, 1000], [0, 1000, 1000, 2000]]))
      })

      test('a loaded box splitting a row starts new rectangles either side', async () => {
        // . . . #
        // . . . #
        // . # . .
        const { controller } = harness()
        await loadBox(controller, [3000, 2000, 4000, 3000])
        await loadBox(controller, [3000, 1000, 4000, 2000])
        await loadBox(controller, [1000, 0, 2000, 1000])

        const rectangles = controller.strategy([100, 100, 3900, 2900])

        expect(rectangles).toHaveLength(3)
        expect(rectangles).toEqual(expect.arrayContaining([
          [0, 1000, 3000, 3000],
          [0, 0, 1000, 1000],
          [2000, 0, 4000, 1000]
        ]))
      })

      test('a box whose load failed can be requested again', async () => {
        const { controller } = harness()
        deserialize.mockReturnValueOnce(failingStream())
        await expect(controller.loader(NEAR_BOX, 10, projection)).rejects.toThrow('range request failed')

        expect(controller.strategy(NEAR_VIEW)).toEqual([NEAR_BOX])
      })
    })

    describe('setViewExtent', () => {
      test('keeps the boxes over the view and one box around it', async () => {
        const { removeLoadedExtent, controller } = harness()
        await loadBox(controller, NEAR_BOX)
        await loadBox(controller, NEXT_BOX)

        await controller.setViewExtent(NEAR_VIEW)

        expect(removeLoadedExtent).not.toHaveBeenCalled()
      })

      test('unloads boxes away from the view, keeping features that cross into a kept box', async () => {
        const nearOnly = featureOver([10, 10, 20, 20], 1)
        const spanning = featureOver([500, 10, 5500, 20], 2)
        const farOnly = featureOver([5200, 10, 5300, 20], 3)
        const { source, removeLoadedExtent, controller } = harness()
        await loadBox(controller, NEAR_BOX, [nearOnly, spanning])
        await loadBox(controller, FAR_BOX, [farOnly, featureOver([500, 10, 5500, 20], 2)])

        await controller.setViewExtent(NEAR_VIEW)

        expect(removeLoadedExtent).toHaveBeenCalledTimes(1)
        expect(removeLoadedExtent).toHaveBeenCalledWith(FAR_BOX)
        expect(source.getFeatures()).toEqual(expect.arrayContaining([nearOnly, spanning]))
        expect(source.getFeatures()).not.toContain(farOnly)
      })

      test('keeps loaded boxes when the view covers the whole country', async () => {
        const { removeLoadedExtent, controller } = harness()
        await loadBox(controller, NEAR_BOX)

        await controller.setViewExtent([-1e7, -1e7, 1e7, 1e7])

        expect(removeLoadedExtent).not.toHaveBeenCalled()
      })

      test('waits for an in-flight buffer build before removing features', async () => {
        const farOnly = featureOver([5200, 10, 5300, 20], 1)
        const { source, removeLoadedExtent, detail, controller } = harness()
        await loadBox(controller, FAR_BOX, [farOnly])
        detail.renderer.ready = false

        const evicting = controller.setViewExtent(ELSEWHERE)
        await detail.listening

        expect(removeLoadedExtent).not.toHaveBeenCalled()
        expect(source.getFeatures()).toContain(farOnly)

        detail.renderer.ready = true
        detail.layer.emitChange()
        await evicting

        expect(source.getFeatures()).not.toContain(farOnly)
      })

      test('moves during a buffer build share one eviction using the latest view', async () => {
        const nearOnly = featureOver([10, 10, 20, 20], 1)
        const farOnly = featureOver([5200, 10, 5300, 20], 2)
        const { source, removeLoadedExtent, detail, controller } = harness()
        await loadBox(controller, NEAR_BOX, [nearOnly])
        await loadBox(controller, FAR_BOX, [farOnly])
        detail.renderer.ready = false

        const away = controller.setViewExtent(ELSEWHERE)
        const back = controller.setViewExtent(NEAR_VIEW)
        await detail.listening
        detail.renderer.ready = true
        detail.layer.emitChange()
        await Promise.all([away, back])

        expect(removeLoadedExtent).toHaveBeenCalledTimes(1)
        expect(removeLoadedExtent).toHaveBeenCalledWith(FAR_BOX)
        expect(source.getFeatures()).toContain(nearOnly)
        expect(source.getFeatures()).not.toContain(farOnly)
      })

      test('a style change empties the loaded boxes', async () => {
        const { removeLoadedExtent, controller } = harness()
        await loadBox(controller, FAR_BOX)
        controller.setStyleConfig(STYLE_CONFIG)

        await controller.setViewExtent(ELSEWHERE)

        expect(removeLoadedExtent).not.toHaveBeenCalled()
      })

      test('a failed load is not tracked as loaded', async () => {
        const { removeLoadedExtent, controller } = harness()
        deserialize.mockReturnValueOnce(failingStream())
        await expect(controller.loader(FAR_BOX, 10, projection)).rejects.toThrow('range request failed')

        await controller.setViewExtent(ELSEWHERE)

        expect(removeLoadedExtent).not.toHaveBeenCalled()
      })

      test('leaves eviction to a load in flight, which evicts once it completes', async () => {
        const nearOnly = featureOver([10, 10, 20, 20], 1)
        const farOnly = featureOver([5200, 10, 5300, 20], 2)
        const { source, removeLoadedExtent, controller } = harness()
        await loadBox(controller, FAR_BOX, [farOnly])
        const held = heldStream(() => streamOf([nearOnly]))
        deserialize.mockReturnValueOnce(held.stream)
        const loading = controller.loader(NEAR_BOX, 10, projection)

        await controller.setViewExtent(NEAR_VIEW)

        expect(removeLoadedExtent).not.toHaveBeenCalled()
        expect(source.getFeatures()).toContain(farOnly)

        held.release()
        await loading

        expect(removeLoadedExtent).toHaveBeenCalledWith(FAR_BOX)
        expect(source.getFeatures()).toEqual([nearOnly])
      })

      test('leaves eviction to a load in flight, which evicts once it fails', async () => {
        const farOnly = featureOver([5200, 10, 5300, 20], 1)
        const { source, controller } = harness()
        await loadBox(controller, FAR_BOX, [farOnly])
        const held = heldStream(failingStream)
        deserialize.mockReturnValueOnce(held.stream)
        const loading = controller.loader(NEAR_BOX, 10, projection)

        await controller.setViewExtent(NEAR_VIEW)

        expect(source.getFeatures()).toContain(farOnly)

        held.release()
        await expect(loading).rejects.toThrow('range request failed')

        expect(source.getFeatures()).not.toContain(farOnly)
      })
    })

    describe('a load the view moves away from', () => {
      test('adds nothing and leaves its boxes free to request again', async () => {
        const farOnly = featureOver([5200, 10, 5300, 20], 1)
        const { source, removeLoadedExtent, controller } = harness()
        await controller.setViewExtent(NEAR_VIEW)

        await loadBox(controller, FAR_BOX, [farOnly])

        expect(source.getFeatures()).toEqual([])
        expect(removeLoadedExtent).toHaveBeenCalledWith(FAR_BOX)
        expect(controller.strategy([5100, 100, 5900, 900])).toEqual([FAR_BOX])
        expect(controller.retryFailedExtents(FAR_BOX)).toBe(false)
      })

      test('stops reading once the view has moved away', async () => {
        vi.stubGlobal('scheduler', { yield: vi.fn(() => Promise.resolve()) })
        advancingClock(8)
        const { source, controller } = harness()
        await controller.setViewExtent(NEAR_VIEW)
        let reads = 0
        async function * movingAway () {
          reads++
          yield featureOver([10, 10, 20, 20], 1)
          controller.setViewExtent(ELSEWHERE)
          reads++
          yield featureOver([30, 10, 40, 20], 2)
          reads++
          yield featureOver([50, 10, 60, 20], 3)
        }
        deserialize.mockReturnValueOnce(movingAway())

        await controller.loader(NEAR_BOX, 10, projection)

        expect(reads).toBe(2)
        expect(source.getFeatures()).toEqual([])
      })

      test('frees its boxes without waiting for a buffer build', async () => {
        vi.stubGlobal('scheduler', { yield: vi.fn(() => Promise.resolve()) })
        advancingClock(8)
        const { detail, controller } = harness()
        await controller.setViewExtent(NEAR_VIEW)
        detail.renderer.ready = false
        async function * movingAway () {
          yield featureOver([10, 10, 20, 20], 1)
          controller.setViewExtent(ELSEWHERE)
          yield featureOver([30, 10, 40, 20], 2)
        }
        deserialize.mockReturnValueOnce(movingAway())

        await controller.loader(NEAR_BOX, 10, projection)

        expect(detail.renderer.ready).toBe(false)
        expect(controller.strategy(NEAR_VIEW)).toEqual([NEAR_BOX])
      })

      test('a load still in range adds its features', async () => {
        const nearOnly = featureOver([10, 10, 20, 20], 1)
        const { source, controller } = harness()
        await controller.setViewExtent(NEAR_VIEW)

        await loadBox(controller, NEAR_BOX, [nearOnly])

        expect(source.getFeatures()).toEqual([nearOnly])
      })
    })

    describe('through OpenLayers loads', () => {
      function loadingHarness () {
        const source = new VectorSource({ strategy: (extent) => controller.strategy(extent) })
        const detail = detailHarness()
        const controller = createFgbLoadController(source, URL, detail.layer, STYLE_CONFIG)
        source.setLoader(controller.loader)
        return { source, detail, controller }
      }

      function settle () {
        return new Promise((resolve) => setTimeout(resolve))
      }

      async function loadThrough (source, extent, features = []) {
        deserialize.mockReturnValueOnce(streamOf(features))
        const ended = new Promise((resolve) => source.once('featuresloadend', resolve))
        source.loadFeatures(extent, 10, projection)
        await ended
        await settle()
      }

      test('a pan requests only the boxes it uncovers', async () => {
        const { source } = loadingHarness()
        await loadThrough(source, [100, 100, 1900, 900])

        await loadThrough(source, [1100, 100, 2900, 900])

        expect(deserialize).toHaveBeenLastCalledWith(URL, expect.objectContaining({
          rect: { minX: 2000, minY: 0, maxX: 3000, maxY: 1000 }
        }))
      })

      test('evicting against the loaded extent keeps it loaded', async () => {
        const nearOnly = featureOver([10, 10, 20, 20], 1)
        const { source, controller } = loadingHarness()
        await loadThrough(source, NEAR_VIEW, [nearOnly])
        await controller.setViewExtent(NEAR_VIEW)
        deserialize.mockClear()

        source.loadFeatures(NEAR_VIEW, 10, projection)

        expect(deserialize).not.toHaveBeenCalled()
        expect(source.getFeatures()).toEqual([nearOnly])
      })

      test('a load the view moved away from is requested again on return', async () => {
        const farOnly = featureOver([5200, 10, 5300, 20], 1)
        const farView = [5100, 100, 5900, 900]
        const { source, controller } = loadingHarness()
        await controller.setViewExtent(NEAR_VIEW)
        await loadThrough(source, farView, [farOnly])

        expect(source.getFeatures()).toEqual([])

        await controller.setViewExtent(farView)
        await loadThrough(source, farView, [farOnly])

        expect(deserialize).toHaveBeenCalledTimes(2)
        expect(source.getFeatures()).toEqual([farOnly])
      })
    })
  })
})
