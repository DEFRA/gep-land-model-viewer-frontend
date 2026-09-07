import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { SELECTION_Z_INDEX } from '../../config/layers.js'

vi.mock('./datasets/layers/cog.js', () => ({ createCogLayer: vi.fn() }))
vi.mock('./datasets/layers/fgb.js', () => ({ createFlatGeobufLayers: vi.fn() }))
vi.mock('./datasets/layers/wms.js', () => ({ createWmsLayer: vi.fn() }))

const { createFlatGeobufLayers } = await import('./datasets/layers/fgb.js')
const { createCogLayer } = await import('./datasets/layers/cog.js')
const { createWmsLayer } = await import('./datasets/layers/wms.js')
const { createLayerController } = await import('./layer-controller.js')

const WOODLAND = {
  id: 'woodland',
  label: 'Ancient Woodland',
  source: { type: 'fgb', url: '/woodland.fgb' }
}
const FLOOD = {
  id: 'flood',
  label: 'Flood Zones',
  source: { type: 'wms', url: '/wms' }
}
const PEAT = {
  id: 'peat',
  label: 'Peaty soil depth',
  source: { type: 'cog', url: '/peat.tif' }
}

function layer (id, { minZoom = -Infinity, layerNames } = {}) {
  let visible = true
  let zIndex

  return {
    get: key => key === 'id' ? id : undefined,
    getMinZoom: () => minZoom,
    getSource: () => ({ getParams: () => layerNames ? { LAYERS: layerNames } : {} }),
    getVisible: () => visible,
    getZIndex: () => zIndex,
    setVisible: vi.fn((next) => { visible = next }),
    setZIndex: vi.fn((next) => { zIndex = next })
  }
}

function deferred () {
  let resolvePromise
  const promise = new Promise((resolve) => {
    resolvePromise = resolve
  })

  return { promise, resolve: resolvePromise }
}

function harness ({ datasets = [WOODLAND], summaries = {} } = {}) {
  const map = {
    addLayer: vi.fn(),
    removeLayer: vi.fn()
  }
  const onDatasetLoaded = vi.fn()
  const onDatasetFailed = vi.fn()
  const controller = createLayerController({
    map,
    datasets,
    summaries,
    onDatasetLoaded,
    onDatasetFailed
  })

  return { controller, map, onDatasetLoaded, onDatasetFailed }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('layer controller', () => {
  test('lazily creates a dataset once, adds it hidden and reports its metadata', async () => {
    const datasetLayer = layer('gep-woodland', { minZoom: 8 })
    createFlatGeobufLayers.mockResolvedValue([datasetLayer])
    const { controller, map, onDatasetLoaded } = harness()

    controller.sync([{ id: 'woodland', ready: false }])
    controller.sync([{ id: 'woodland', ready: false }])

    await vi.waitFor(() => expect(onDatasetLoaded).toHaveBeenCalledWith('woodland', { minZoom: 9 }))
    expect(createFlatGeobufLayers).toHaveBeenCalledTimes(1)
    expect(datasetLayer.setVisible).toHaveBeenCalledWith(false)
    expect(datasetLayer.setVisible.mock.invocationCallOrder[0]).toBeLessThan(map.addLayer.mock.invocationCallOrder[0])
    expect(map.addLayer).toHaveBeenCalledWith(datasetLayer)
  })

  test('reports resolved WMS layer names as reducer metadata', async () => {
    const wmsLayer = layer('gep-flood', { layerNames: 'zone_2,zone_3' })
    createWmsLayer.mockResolvedValue(wmsLayer)
    const { controller, onDatasetLoaded } = harness({ datasets: [FLOOD] })

    controller.sync([{ id: 'flood', ready: false }])

    await vi.waitFor(() => expect(onDatasetLoaded).toHaveBeenCalledWith('flood', {
      minZoom: undefined,
      wmsLayerNames: ['zone_2', 'zone_3']
    }))
  })

  test('creates a COG dataset through its layer factory', async () => {
    const cogLayer = layer('gep-peat')
    createCogLayer.mockResolvedValue(cogLayer)
    const { controller, map, onDatasetLoaded } = harness({ datasets: [PEAT] })

    controller.sync([{ id: 'peat', ready: false }])

    await vi.waitFor(() => expect(onDatasetLoaded).toHaveBeenCalledOnce())
    expect(createCogLayer).toHaveBeenCalledWith(PEAT, 'gep-peat')
    expect(map.addLayer).toHaveBeenCalledWith(cogLayer)
  })

  test('reports a WMS dataset with no queryable layers as failed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    createWmsLayer.mockResolvedValue(null)
    const { controller, map, onDatasetFailed } = harness({ datasets: [FLOOD] })

    controller.sync([{ id: 'flood', ready: false }])

    await vi.waitFor(() => expect(onDatasetFailed).toHaveBeenCalledWith('flood'))
    expect(map.addLayer).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith(
      'Failed to load data layer flood',
      expect.objectContaining({ message: 'No OpenLayers layers were created' })
    )
  })

  test('keeps dataset pairs and summaries in Contents order', async () => {
    const detail = layer('gep-woodland')
    const overview = layer('gep-woodland-overview')
    createFlatGeobufLayers.mockResolvedValue([detail, overview])
    const grid = { setVisible: vi.fn(), setZIndex: vi.fn() }
    const { controller, onDatasetLoaded } = harness({ summaries: { grid } })
    const loading = [
      { id: 'woodland', ready: false },
      { id: 'grid', ready: true }
    ]

    controller.sync(loading)
    await vi.waitFor(() => expect(onDatasetLoaded).toHaveBeenCalledOnce())
    controller.sync([
      { id: 'woodland', ready: true },
      { id: 'grid', ready: true }
    ])

    expect(detail.setVisible).toHaveBeenLastCalledWith(true)
    expect(overview.setVisible).toHaveBeenLastCalledWith(true)
    expect(detail.setZIndex).toHaveBeenLastCalledWith(SELECTION_Z_INDEX - 1)
    expect(overview.setZIndex).toHaveBeenLastCalledWith(SELECTION_Z_INDEX - 1)
    expect(grid.setVisible).toHaveBeenLastCalledWith(true)
    expect(grid.setZIndex).toHaveBeenLastCalledWith((SELECTION_Z_INDEX - 1) / 2)

    controller.sync([
      { id: 'grid', ready: true },
      { id: 'woodland', ready: true }
    ])

    expect(detail.setZIndex).toHaveBeenLastCalledWith((SELECTION_Z_INDEX - 1) / 2)
    expect(overview.setZIndex).toHaveBeenLastCalledWith((SELECTION_Z_INDEX - 1) / 2)
    expect(grid.setZIndex).toHaveBeenLastCalledWith(SELECTION_Z_INDEX - 1)
  })

  test('hides removed layers and reuses them when the dataset is added again', async () => {
    const datasetLayer = layer('gep-woodland')
    createFlatGeobufLayers.mockResolvedValue([datasetLayer])
    const { controller, onDatasetLoaded } = harness()

    controller.sync([{ id: 'woodland', ready: false }])
    await vi.waitFor(() => expect(onDatasetLoaded).toHaveBeenCalledOnce())
    controller.sync([{ id: 'woodland', ready: true }])
    controller.sync([{ id: 'woodland', ready: true, hidden: true }])
    expect(datasetLayer.setVisible).toHaveBeenLastCalledWith(false)

    controller.sync([])
    const readded = [{ id: 'woodland', ready: false }]
    controller.sync(readded)

    expect(createFlatGeobufLayers).toHaveBeenCalledTimes(1)
    expect(onDatasetLoaded).toHaveBeenCalledTimes(2)
  })

  test('removal during loading leaves the completed dataset cached and hidden', async () => {
    const pending = deferred()
    const datasetLayer = layer('gep-woodland')
    createFlatGeobufLayers.mockReturnValue(pending.promise)
    const { controller, map, onDatasetLoaded } = harness()

    controller.sync([{ id: 'woodland', ready: false }])
    controller.sync([])
    pending.resolve([datasetLayer])

    await vi.waitFor(() => expect(map.addLayer).toHaveBeenCalledWith(datasetLayer))
    expect(datasetLayer.getVisible()).toBe(false)
    expect(onDatasetLoaded).not.toHaveBeenCalled()

    controller.sync([{ id: 'woodland', ready: false }])
    expect(onDatasetLoaded).toHaveBeenCalledOnce()
    expect(createFlatGeobufLayers).toHaveBeenCalledTimes(1)
  })

  test('re-adding a dataset while it loads reuses the pending work', async () => {
    const pending = deferred()
    const datasetLayer = layer('gep-woodland')
    createFlatGeobufLayers.mockReturnValue(pending.promise)
    const { controller, onDatasetLoaded } = harness()

    controller.sync([{ id: 'woodland', ready: false }])
    controller.sync([])
    controller.sync([{ id: 'woodland', ready: false }])
    expect(createFlatGeobufLayers).toHaveBeenCalledTimes(1)

    pending.resolve([datasetLayer])
    await vi.waitFor(() => expect(onDatasetLoaded).toHaveBeenCalledOnce())

    expect(datasetLayer.getVisible()).toBe(false)
    expect(createFlatGeobufLayers).toHaveBeenCalledTimes(1)
  })

  test('disposal during loading cleans up late layers without reporting completion', async () => {
    const pending = deferred()
    const datasetLayer = layer('gep-woodland')
    createFlatGeobufLayers.mockReturnValue(pending.promise)
    const { controller, map, onDatasetLoaded, onDatasetFailed } = harness()

    controller.sync([{ id: 'woodland', ready: false }])
    controller.dispose()
    pending.resolve([datasetLayer])

    await vi.waitFor(() => expect(map.removeLayer).toHaveBeenCalledWith(datasetLayer))
    expect(map.addLayer).not.toHaveBeenCalled()
    expect(onDatasetLoaded).not.toHaveBeenCalled()
    expect(onDatasetFailed).not.toHaveBeenCalled()
  })

  test('final disposal removes each created dataset layer once', async () => {
    const detail = layer('gep-woodland')
    const overview = layer('gep-woodland-overview')
    createFlatGeobufLayers.mockResolvedValue([detail, overview])
    const { controller, map, onDatasetLoaded } = harness()

    controller.sync([{ id: 'woodland', ready: false }])
    await vi.waitFor(() => expect(onDatasetLoaded).toHaveBeenCalledOnce())
    controller.dispose()
    controller.dispose()
    controller.sync([{ id: 'woodland', ready: true }])

    expect(map.removeLayer.mock.calls).toEqual([[detail], [overview]])
    expect(createFlatGeobufLayers).toHaveBeenCalledTimes(1)
  })
})
