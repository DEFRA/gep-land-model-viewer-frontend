import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('flatgeobuf/lib/mjs/ol.js', () => ({
  deserialize: vi.fn()
}))

const { default: VectorSource } = await import('ol/source/Vector.js')
const { deserialize } = await import('flatgeobuf/lib/mjs/ol.js')
const { createFgbLoadController } = await import('./fgb-loader.js')

const URL = '/land-model/vector/test.fgb'
const EXTENT = [100, 200, 300, 400]
const OTHER_EXTENT = [500, 600, 700, 800]
const projection = { getCode: () => 'EPSG:27700' }

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
    removeLoadedExtent: vi.fn(),
    changed: vi.fn()
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

  test('returns the decoded features through the OpenLayers promise-loader lifecycle', async () => {
    const features = [{ id: 1 }, { id: 2 }, { id: 3 }]
    deserialize.mockReturnValueOnce(streamOf(features))
    const source = sourceHarness()
    const detail = detailHarness()
    const { loader } = createFgbLoadController(source, URL, detail.layer)

    const loaded = loader(EXTENT, 10, projection)

    expect(loaded).toBeInstanceOf(Promise)
    await expect(loaded).resolves.toEqual(features)
    expect(deserialize).toHaveBeenCalledWith(
      URL,
      { minX: 100, minY: 200, maxX: 300, maxY: 400 },
      undefined,
      undefined,
      undefined,
      false,
      'EPSG:27700',
      'EPSG:27700'
    )
  })

  test('uses scheduler.yield when decoding spends its time slice', async () => {
    deserialize.mockReturnValueOnce(streamOf([{ id: 1 }, { id: 2 }]))
    const schedulerYield = vi.fn(() => Promise.resolve())
    vi.stubGlobal('scheduler', { yield: schedulerYield })
    advancingClock(8)
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    const detail = detailHarness()
    const { loader } = createFgbLoadController(sourceHarness(), URL, detail.layer)

    await loader(EXTENT, 10, projection)

    expect(schedulerYield).toHaveBeenCalled()
    expect(setTimeoutSpy).not.toHaveBeenCalled()
  })

  test('falls back to a timer when scheduler.yield is unavailable', async () => {
    deserialize.mockReturnValueOnce(streamOf([{ id: 1 }]))
    vi.stubGlobal('scheduler', undefined)
    advancingClock(8)
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    const detail = detailHarness()
    const { loader } = createFgbLoadController(sourceHarness(), URL, detail.layer)

    await loader(EXTENT, 10, projection)

    expect(setTimeoutSpy).toHaveBeenCalled()
  })

  test('does not yield while decoding stays inside the time slice', async () => {
    deserialize.mockReturnValueOnce(streamOf([{ id: 1 }, { id: 2 }]))
    const schedulerYield = vi.fn(() => Promise.resolve())
    vi.stubGlobal('scheduler', { yield: schedulerYield })
    advancingClock(1)
    const detail = detailHarness()
    const { loader } = createFgbLoadController(sourceHarness(), URL, detail.layer)

    await loader(EXTENT, 10, projection)

    expect(schedulerYield).not.toHaveBeenCalled()
  })

  test('waits for an older WebGL buffer build before completing an extent', async () => {
    const features = [{ id: 1 }]
    deserialize.mockReturnValueOnce(streamOf(features))
    const detail = detailHarness(false)
    const { loader } = createFgbLoadController(sourceHarness(), URL, detail.layer)
    let completed = false

    const loaded = loader(EXTENT, 10, projection).then((result) => {
      completed = true
      return result
    })
    await detail.listening

    expect(completed).toBe(false)
    detail.renderer.ready = true
    detail.layer.emitChange()

    await expect(loaded).resolves.toEqual(features)
    expect(detail.layer.un).toHaveBeenCalled()
  })

  test('OpenLayers adds a completed extent as one batch', async () => {
    const { default: Feature } = await import('ol/Feature.js')
    const features = Array.from({ length: 2001 }, (_, index) => new Feature({ index }))
    deserialize.mockReturnValueOnce(streamOf(features))
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const source = new VectorSource({ strategy: () => [EXTENT] })
    const detail = detailHarness()
    const addFeaturesSpy = vi.spyOn(source, 'addFeatures')
    const { loader } = createFgbLoadController(source, URL, detail.layer)
    source.setLoader(loader)
    const ended = new Promise((resolve) => source.once('featuresloadend', resolve))

    source.loadFeatures(EXTENT, 10, projection)
    const event = await ended

    expect(source.getFeatures()).toHaveLength(2001)
    expect(addFeaturesSpy).toHaveBeenCalledTimes(1)
    expect(addFeaturesSpy).toHaveBeenCalledWith(features)
    expect(event.features).toEqual(features)
    expect(source.loading).toBe(0)
    source.dispose()
  })

  test('keeps failures quiet until the failed viewport is granted a retry', async () => {
    deserialize.mockImplementation(() => failingStream())
    const source = new VectorSource({ strategy: () => [EXTENT] })
    const detail = detailHarness()
    const controller = createFgbLoadController(source, URL, detail.layer)
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
      .mockReturnValueOnce(streamOf([{ id: 1 }]))
    const source = sourceHarness()
    const detail = detailHarness()
    const controller = createFgbLoadController(source, URL, detail.layer)

    await expect(controller.loader(EXTENT, 10, projection)).rejects.toThrow('range request failed')
    await expect(controller.loader(OTHER_EXTENT, 10, projection)).rejects.toThrow('range request failed')
    await controller.loader(OTHER_EXTENT, 10, projection)

    expect(controller.retryFailedExtents(EXTENT)).toBe(true)
    expect(controller.retryFailedExtents(OTHER_EXTENT)).toBe(false)
  })
})
