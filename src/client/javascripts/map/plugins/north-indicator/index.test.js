import { vi, describe, test, expect, afterEach } from 'vitest'
import { createNorthIndicatorPlugin } from './index.js'

describe('#createNorthIndicatorPlugin', () => {
  test('onClick animates the view back to north', async () => {
    const plugin = createNorthIndicatorPlugin()
    const { buttons: [button] } = await plugin.load()
    const view = { animate: vi.fn() }

    button.onClick(new Event('click'), { mapProvider: { map: { getView: () => view } } })

    expect(view.animate).toHaveBeenCalledWith({ rotation: 0, duration: 300 })
  })
})

describe('InitComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function createHarness (rotation = 0) {
    const icon = { style: {} }
    const view = {
      getRotation: vi.fn(() => rotation),
      on: vi.fn()
    }
    const mapProvider = {
      map: {
        getView: () => view,
        getTargetElement: () => ({
          closest: () => ({
            querySelector: () => icon
          })
        })
      }
    }
    return { icon, view, mapProvider }
  }

  test('sets up rotation listener when map is ready', async () => {
    const { icon, view, mapProvider } = createHarness(0.5)
    const plugin = createNorthIndicatorPlugin()
    const { InitComponent } = await plugin.load()

    InitComponent({ mapState: { isMapReady: true }, mapProvider })

    expect(view.on).toHaveBeenCalledWith('change:rotation', expect.any(Function))
    expect(icon.style.transform).toBe('rotate(0.5rad)')
  })

  test('skips setup when map is not ready', async () => {
    const { view, mapProvider } = createHarness()
    const plugin = createNorthIndicatorPlugin()
    const { InitComponent } = await plugin.load()

    InitComponent({ mapState: { isMapReady: false }, mapProvider })

    expect(view.on).not.toHaveBeenCalled()
  })

  test('retries when icon element is not yet in the DOM', async () => {
    const view = { getRotation: vi.fn(() => 0), on: vi.fn() }
    const mapProvider = {
      map: {
        getView: () => view,
        getTargetElement: () => ({
          closest: () => ({
            querySelector: () => null
          })
        })
      }
    }
    const plugin = createNorthIndicatorPlugin()
    const { InitComponent } = await plugin.load()

    InitComponent({ mapState: { isMapReady: true }, mapProvider })

    expect(view.on).not.toHaveBeenCalled()
  })

  test('only initializes once across multiple renders', async () => {
    const { view, mapProvider } = createHarness()
    const plugin = createNorthIndicatorPlugin()
    const { InitComponent } = await plugin.load()

    InitComponent({ mapState: { isMapReady: true }, mapProvider })
    InitComponent({ mapState: { isMapReady: true }, mapProvider })

    expect(view.on).toHaveBeenCalledTimes(1)
  })
})
