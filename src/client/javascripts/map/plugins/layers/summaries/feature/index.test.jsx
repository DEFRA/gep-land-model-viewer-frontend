// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/preact'
import { InfoPanelContext } from '../../panels/info/context.js'

vi.mock('./feature-layer.js', () => ({
  createFeatureLayer: vi.fn()
}))

vi.mock('./data.js', () => ({
  getFeatureDetails: vi.fn(() => Promise.resolve(null))
}))

vi.mock('../../../../config/map-styles.js', () => ({
  OS_NGD_TILESET_URL: '/os/ngd/collections/ngd-base/tiles/27700',
  OS_NGD_STYLE_IDS: ['os-outdoor-ngd', 'os-road-ngd']
}))

const { createFeatureLayer } = await import('./feature-layer.js')
const { createFeatureSummary } = await import('./index.jsx')
const { getFeatureDetails } = await import('./data.js')

function createMockFeatureLayer () {
  return {
    refreshSource: vi.fn(),
    selectFeature: vi.fn(),
    clearSelection: vi.fn(),
    setEnabled: vi.fn(),
    findFeatureAtPixel: vi.fn(),
    dispose: vi.fn()
  }
}

describe('#createFeatureSummary', () => {
  let mockFeatureLayer
  let olMap
  let zoom

  beforeEach(() => {
    zoom = 12
    olMap = {
      getPixelFromCoordinate: vi.fn(() => [100, 200]),
      getView: vi.fn(() => ({ getZoom: vi.fn(() => zoom) }))
    }
    mockFeatureLayer = createMockFeatureLayer()
    createFeatureLayer.mockReturnValue(mockFeatureLayer)
  })

  function registeredSource () {
    const summary = createFeatureSummary(olMap)
    summary.setVisible(true)
    return summary
  }

  test('shares the basemap source when the style serves the tileset', () => {
    createFeatureSummary(olMap).setMapStyle('os-outdoor-ngd')

    expect(mockFeatureLayer.refreshSource).toHaveBeenCalledWith(true)
  })

  test('uses a dedicated source when the style does not serve the tileset', () => {
    createFeatureSummary(olMap).setMapStyle('os-outdoor-raster')

    expect(mockFeatureLayer.refreshSource).toHaveBeenCalledWith(false)
  })

  test('a style switch to another tileset style keeps sharing the basemap source', () => {
    const summary = createFeatureSummary(olMap)

    summary.setMapStyle('os-outdoor-ngd')
    mockFeatureLayer.refreshSource.mockClear()
    summary.setMapStyle('os-road-ngd')

    expect(mockFeatureLayer.refreshSource).toHaveBeenCalledWith(true)
  })

  test('a style switch to a non-tileset style falls back to a dedicated source', () => {
    const summary = createFeatureSummary(olMap)

    summary.setMapStyle('os-outdoor-ngd')
    mockFeatureLayer.refreshSource.mockClear()
    summary.setMapStyle('os-outdoor-raster')

    expect(mockFeatureLayer.refreshSource).toHaveBeenCalledWith(false)
  })

  test('setVisible(true) enables the feature layer and its lifetime source', () => {
    mockFeatureLayer.findFeatureAtPixel.mockReturnValue({ osid: 'abc-123' })
    const summary = createFeatureSummary(olMap)

    summary.setVisible(true)

    expect(mockFeatureLayer.setEnabled).toHaveBeenCalledWith(true)
    expect(summary.getHits([418700, 385100])).toHaveLength(1)
  })

  test('setVisible(false) hides the layer and invalidates its source', () => {
    mockFeatureLayer.findFeatureAtPixel.mockReturnValue({ osid: 'abc-123' })
    const summary = createFeatureSummary(olMap)

    summary.setVisible(true)
    const hit = summary.getHits([418700, 385100])[0]
    summary.setVisible(false)

    expect(mockFeatureLayer.setEnabled).toHaveBeenLastCalledWith(false)
    expect(summary.getHits([418700, 385100])).toEqual([])
    expect(hit.stillValid()).toBe(false)
  })

  test('a zoom below the feature floor prevents hits and invalidates an existing hit', () => {
    mockFeatureLayer.findFeatureAtPixel.mockReturnValue({ osid: 'abc-123' })
    const summary = registeredSource()
    const hit = summary.getHits([418700, 385100])[0]

    zoom = 8

    expect(summary.getHits([418700, 385100])).toEqual([])
    expect(hit.stillValid()).toBe(false)
  })

  test('a click on a feature yields an OS feature hit', () => {
    mockFeatureLayer.findFeatureAtPixel.mockReturnValue({ osid: 'abc-123', description: 'Arable Land' })
    const source = registeredSource()

    const hits = source.getHits([418700, 385100])

    expect(olMap.getPixelFromCoordinate).toHaveBeenCalledWith([418700, 385100])
    expect(hits).toHaveLength(1)
    expect(hits[0].label).toBe('OS feature')
    expect(hits[0].panelTitle).toBeUndefined()
    expect(mockFeatureLayer.selectFeature).not.toHaveBeenCalled()
  })

  test('selecting the hit highlights the feature by osid', () => {
    mockFeatureLayer.findFeatureAtPixel.mockReturnValue({ osid: 'abc-123' })
    const source = registeredSource()

    source.getHits([418700, 385100])[0].select()

    expect(mockFeatureLayer.selectFeature).toHaveBeenCalledWith('abc-123')
  })

  test('a click with nothing under it yields no hits', () => {
    mockFeatureLayer.findFeatureAtPixel.mockReturnValue(null)
    const source = registeredSource()

    expect(source.getHits([418700, 385100])).toEqual([])
    expect(mockFeatureLayer.selectFeature).not.toHaveBeenCalled()
  })

  test('loadDetails fetches details by osid', async () => {
    mockFeatureLayer.findFeatureAtPixel.mockReturnValue({ osid: 'abc-123' })
    const source = registeredSource()

    await source.getHits([418700, 385100])[0].loadDetails({ signal: null })

    expect(getFeatureDetails).toHaveBeenCalledWith('abc-123')
  })

  test('the hit renders its OSID when details are unavailable', () => {
    mockFeatureLayer.findFeatureAtPixel.mockReturnValue({ osid: 'abc-123' })
    const source = registeredSource()

    const { container } = render(
      <InfoPanelContext.Provider value={{ sections: new Map(), goToSampleArea: vi.fn() }}>
        {source.getHits([418700, 385100])[0].render(null)}
      </InfoPanelContext.Provider>
    )

    expect(container.textContent).toContain('abc-123')
    expect(container.textContent).toContain('This parcel is not covered by the sample land model.')
  })

  test('clearSelection clears the feature selection', () => {
    const source = registeredSource()

    source.clearSelection()

    expect(mockFeatureLayer.clearSelection).toHaveBeenCalled()
  })

  test('dispose clears the selection and disposes the feature layer', () => {
    const summary = createFeatureSummary(olMap)

    summary.dispose()

    expect(mockFeatureLayer.clearSelection).toHaveBeenCalled()
    expect(mockFeatureLayer.dispose).toHaveBeenCalled()
  })
})
