import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { SELECTION_Z_INDEX } from '../../config/layers.js'
import sssiStyle from '../../../../data/styles/sssi.json'

vi.mock('./datasets/layers/cog.js', () => ({ createCogLayer: vi.fn() }))
vi.mock('./datasets/layers/fgb.js', () => ({ createFlatGeobufLayer: vi.fn() }))
vi.mock('./datasets/layers/wms.js', () => ({ createWmsLayer: vi.fn() }))

const { createFlatGeobufLayer } = await import('./datasets/layers/fgb.js')
const { createCogLayer } = await import('./datasets/layers/cog.js')
const { createWmsLayer } = await import('./datasets/layers/wms.js')
const { createLayerController } = await import('./layer-controller.js')

const WOODLAND = {
  id: 'woodland',
  label: 'Ancient Woodland',
  source: { type: 'fgb', url: '/woodland.fgb', opacity: 0.5 }
}
const FLOOD = {
  id: 'flood',
  label: 'Flood Zones',
  source: { type: 'wms', url: '/wms', opacity: 0.5 }
}
const PEAT = {
  id: 'peat',
  label: 'Peaty soil depth',
  source: { type: 'cog', url: '/peat.tif', opacity: 0.5 }
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

function createDatasetLayer (layers) {
  return { layers, applyStyle: vi.fn(), setOpacity: vi.fn() }
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
  test('applies colour and opacity overrides independently and restores defaults', async () => {
    const dataset = { ...WOODLAND, source: { ...WOODLAND.source, styleConfig: sssiStyle, opacity: 0.7 } }
    const datasetLayer = createDatasetLayer([layer('gep-woodland'), layer('gep-woodland-overview')])
    createFlatGeobufLayer.mockResolvedValue(datasetLayer)
    const { controller, onDatasetLoaded } = harness({ datasets: [dataset] })
    controller.sync([{ id: 'woodland', ready: false }])
    await vi.waitFor(() => expect(onDatasetLoaded).toHaveBeenCalledOnce())
    expect(datasetLayer.applyStyle).not.toHaveBeenCalled()
    expect(datasetLayer.setOpacity).not.toHaveBeenCalled()

    const edited = {
      id: 'woodland',
      ready: true,
      styleOverrides: { classes: [{ fill: [255, 0, 0, 1], stroke: { color: [0, 0, 0, 1] } }] },
      opacity: 0.4
    }
    controller.sync([edited])
    expect(datasetLayer.applyStyle).toHaveBeenLastCalledWith({
      ...sssiStyle,
      classes: [{ ...sssiStyle.classes[0], fill: [255, 0, 0, 1], stroke: { color: [0, 0, 0, 1], width: 1.25 } }]
    })
    expect(datasetLayer.setOpacity).toHaveBeenLastCalledWith(0.4)

    controller.sync([{ ...edited, hidden: true }])
    controller.sync([{ id: 'grid', ready: true }, edited])
    expect(datasetLayer.applyStyle).toHaveBeenCalledOnce()
    expect(datasetLayer.setOpacity).toHaveBeenCalledOnce()

    controller.sync([{ ...edited, opacity: 0.6 }])
    expect(datasetLayer.applyStyle).toHaveBeenCalledOnce()
    expect(datasetLayer.setOpacity).toHaveBeenLastCalledWith(0.6)

    controller.sync([{ id: 'woodland', ready: true }])
    expect(datasetLayer.applyStyle).toHaveBeenLastCalledWith(sssiStyle)
    expect(datasetLayer.setOpacity).toHaveBeenLastCalledWith(0.7)

    controller.sync([edited])
    controller.sync([])
    controller.sync([{ id: 'woodland', ready: false }])
    expect(datasetLayer.applyStyle).toHaveBeenLastCalledWith(sssiStyle)
    expect(datasetLayer.setOpacity).toHaveBeenLastCalledWith(0.7)
    expect(createFlatGeobufLayer).toHaveBeenCalledOnce()
  })

  test('lazily creates a dataset once, adds it hidden and reports its metadata', async () => {
    const mapLayer = layer('gep-woodland', { minZoom: 8 })
    createFlatGeobufLayer.mockResolvedValue(createDatasetLayer([mapLayer]))
    const { controller, map, onDatasetLoaded } = harness()

    controller.sync([{ id: 'woodland', ready: false }])
    controller.sync([{ id: 'woodland', ready: false }])

    await vi.waitFor(() => expect(onDatasetLoaded).toHaveBeenCalledWith('woodland', { minZoom: 9 }))
    expect(createFlatGeobufLayer).toHaveBeenCalledTimes(1)
    expect(mapLayer.setVisible).toHaveBeenCalledWith(false)
    expect(mapLayer.setVisible.mock.invocationCallOrder[0]).toBeLessThan(map.addLayer.mock.invocationCallOrder[0])
    expect(map.addLayer).toHaveBeenCalledWith(mapLayer)
  })

  test('reports resolved WMS layer names as reducer metadata', async () => {
    const wmsLayer = layer('gep-flood', { layerNames: 'zone_2,zone_3' })
    createWmsLayer.mockResolvedValue(createDatasetLayer([wmsLayer]))
    const { controller, onDatasetLoaded } = harness({ datasets: [FLOOD] })

    controller.sync([{ id: 'flood', ready: false }])

    await vi.waitFor(() => expect(onDatasetLoaded).toHaveBeenCalledWith('flood', {
      minZoom: undefined,
      wmsLayerNames: ['zone_2', 'zone_3']
    }))
  })

  test('creates a COG dataset through its layer factory', async () => {
    const cogLayer = layer('gep-peat')
    createCogLayer.mockResolvedValue(createDatasetLayer([cogLayer]))
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
    createFlatGeobufLayer.mockResolvedValue(createDatasetLayer([detail, overview]))
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
    const mapLayer = layer('gep-woodland')
    createFlatGeobufLayer.mockResolvedValue(createDatasetLayer([mapLayer]))
    const { controller, onDatasetLoaded } = harness()

    controller.sync([{ id: 'woodland', ready: false }])
    await vi.waitFor(() => expect(onDatasetLoaded).toHaveBeenCalledOnce())
    controller.sync([{ id: 'woodland', ready: true }])
    controller.sync([{ id: 'woodland', ready: true, hidden: true }])
    expect(mapLayer.setVisible).toHaveBeenLastCalledWith(false)

    controller.sync([])
    const readded = [{ id: 'woodland', ready: false }]
    controller.sync(readded)

    expect(createFlatGeobufLayer).toHaveBeenCalledTimes(1)
    expect(onDatasetLoaded).toHaveBeenCalledTimes(2)
  })

  test('removal during loading leaves the completed dataset cached and hidden', async () => {
    const pending = deferred()
    const mapLayer = layer('gep-woodland')
    createFlatGeobufLayer.mockReturnValue(pending.promise)
    const { controller, map, onDatasetLoaded } = harness()

    controller.sync([{ id: 'woodland', ready: false }])
    controller.sync([])
    pending.resolve(createDatasetLayer([mapLayer]))

    await vi.waitFor(() => expect(map.addLayer).toHaveBeenCalledWith(mapLayer))
    expect(mapLayer.getVisible()).toBe(false)
    expect(onDatasetLoaded).not.toHaveBeenCalled()

    controller.sync([{ id: 'woodland', ready: false }])
    expect(onDatasetLoaded).toHaveBeenCalledOnce()
    expect(createFlatGeobufLayer).toHaveBeenCalledTimes(1)
  })

  test('re-adding a dataset while it loads reuses the pending work', async () => {
    const pending = deferred()
    const mapLayer = layer('gep-woodland')
    createFlatGeobufLayer.mockReturnValue(pending.promise)
    const { controller, onDatasetLoaded } = harness()

    controller.sync([{ id: 'woodland', ready: false }])
    controller.sync([])
    controller.sync([{ id: 'woodland', ready: false }])
    expect(createFlatGeobufLayer).toHaveBeenCalledTimes(1)

    pending.resolve(createDatasetLayer([mapLayer]))
    await vi.waitFor(() => expect(onDatasetLoaded).toHaveBeenCalledOnce())

    expect(mapLayer.getVisible()).toBe(false)
    expect(createFlatGeobufLayer).toHaveBeenCalledTimes(1)
  })

  test('disposal during loading cleans up late layers without reporting completion', async () => {
    const pending = deferred()
    const mapLayer = layer('gep-woodland')
    createFlatGeobufLayer.mockReturnValue(pending.promise)
    const { controller, map, onDatasetLoaded, onDatasetFailed } = harness()

    controller.sync([{ id: 'woodland', ready: false }])
    controller.dispose()
    pending.resolve(createDatasetLayer([mapLayer]))

    await vi.waitFor(() => expect(map.removeLayer).toHaveBeenCalledWith(mapLayer))
    expect(map.addLayer).not.toHaveBeenCalled()
    expect(onDatasetLoaded).not.toHaveBeenCalled()
    expect(onDatasetFailed).not.toHaveBeenCalled()
  })

  test('final disposal removes each created dataset layer once', async () => {
    const detail = layer('gep-woodland')
    const overview = layer('gep-woodland-overview')
    createFlatGeobufLayer.mockResolvedValue(createDatasetLayer([detail, overview]))
    const { controller, map, onDatasetLoaded } = harness()

    controller.sync([{ id: 'woodland', ready: false }])
    await vi.waitFor(() => expect(onDatasetLoaded).toHaveBeenCalledOnce())
    controller.dispose()
    controller.dispose()
    controller.sync([{ id: 'woodland', ready: true }])

    expect(map.removeLayer.mock.calls).toEqual([[detail], [overview]])
    expect(createFlatGeobufLayer).toHaveBeenCalledTimes(1)
  })
})
