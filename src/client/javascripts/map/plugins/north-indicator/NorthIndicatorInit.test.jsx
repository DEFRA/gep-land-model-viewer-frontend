// @vitest-environment jsdom
import { vi, describe, test, expect, afterEach } from 'vitest'
import { render } from '@testing-library/preact'
import { NorthIndicatorInit } from './NorthIndicatorInit.jsx'

afterEach(() => {
  document.body.replaceChildren()
})

function addIcon (app) {
  const button = document.createElement('button')
  button.className = 'im-c-map-button--gep-north-indicator'
  const icon = document.createElement('span')
  icon.className = 'im-c-icon'
  button.appendChild(icon)
  app.appendChild(button)
  return icon
}

function createHarness ({ rotation = 0 } = {}) {
  const app = document.createElement('div')
  app.className = 'im-o-app'
  const target = document.createElement('div')
  app.appendChild(target)
  document.body.appendChild(app)

  const icon = addIcon(app)
  const mapView = {
    getRotation: vi.fn(() => rotation),
    on: vi.fn(),
    un: vi.fn()
  }
  const mapProvider = {
    map: {
      getView: () => mapView,
      getTargetElement: () => target
    }
  }

  return { icon, mapView, mapProvider }
}

function renderInit (mapProvider, isMapReady = true) {
  return render(<NorthIndicatorInit mapState={{ isMapReady }} mapProvider={mapProvider} />)
}

describe('NorthIndicatorInit', () => {
  test('rotates the icon to the current bearing and follows later changes', () => {
    const { icon, mapView, mapProvider } = createHarness({ rotation: 0.5 })

    renderInit(mapProvider)

    expect(icon.style.transform).toBe('rotate(0.5rad)')
    expect(mapView.on).toHaveBeenCalledWith('change:rotation', expect.any(Function))
  })

  test('stops listening when unmounted', () => {
    const { mapView, mapProvider } = createHarness()

    const { unmount } = renderInit(mapProvider)
    const [, handler] = mapView.on.mock.calls[0]
    unmount()

    expect(mapView.un).toHaveBeenCalledWith('change:rotation', handler)
  })

  test('waits for the map before listening', () => {
    const { mapView, mapProvider } = createHarness()

    renderInit(mapProvider, false)

    expect(mapView.on).not.toHaveBeenCalled()
  })
})
