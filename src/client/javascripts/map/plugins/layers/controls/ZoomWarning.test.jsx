// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { fireEvent, render } from '@testing-library/preact'
import { ZoomWarning } from './ZoomWarning.jsx'

let view
let services
let olView
let mapProvider

function renderWarning (props = {}) {
  const pluginState = { layers: [], ...props.pluginState }
  view = render(
    <ZoomWarning
      mapState={{ zoom: props.zoom ?? 8 }}
      pluginState={pluginState}
      mapProvider={mapProvider}
      services={services}
    />
  )
  return view
}

beforeEach(() => {
  services = { announce: vi.fn() }
  olView = { animate: vi.fn() }
  mapProvider = { map: { getView: () => olView } }
})

describe('ZoomWarning', () => {
  test('warns when an enabled summary is not drawn at this zoom, and announces it', () => {
    renderWarning({ pluginState: { layers: [{ id: 'grid', ready: true }] } })

    expect(view.container.querySelector('.app-map__zoom-warning').textContent).toBe('Zoom in to see Grid squares')
    expect(services.announce).toHaveBeenCalledWith('Zoom in to see Grid squares')
  })

  test('warns about a dataset that has a zoom floor', () => {
    renderWarning({
      pluginState: {
        layers: [{ id: 'woodland', title: 'Ancient Woodland', ready: true, minZoom: 10 }]
      }
    })

    expect(view.container.querySelector('.app-map__zoom-warning').textContent).toBe('Zoom in to see Ancient Woodland')
  })

  test('groups several out-of-range layers into one warning', () => {
    renderWarning({
      pluginState: {
        layers: [
          { id: 'grid', ready: true },
          { id: 'woodland', title: 'Ancient Woodland', ready: true, minZoom: 10 }
        ]
      }
    })

    expect(view.container.querySelector('.app-map__zoom-warning').textContent).toBe('Zoom in to see the selected data layers')
    expect(services.announce).toHaveBeenCalledWith('Zoom in to see the selected data layers')
  })

  test('zooms to the level where every warned layer is drawn', () => {
    renderWarning({
      pluginState: {
        layers: [
          { id: 'grid', ready: true },
          { id: 'woodland', title: 'Ancient Woodland', ready: true, minZoom: 12 },
          { id: 'peat', title: 'Peat', ready: true, minZoom: 7 }
        ]
      }
    })

    fireEvent.click(view.getByRole('button', { name: 'Zoom in' }))

    expect(olView.animate).toHaveBeenCalledWith({ zoom: 12, duration: 300 })
  })

  test('does not warn about a loading dataset retaining its previous zoom floor', () => {
    renderWarning({
      pluginState: {
        layers: [{ id: 'woodland', ready: false, minZoom: 10 }]
      }
    })

    expect(view.container.querySelector('.app-map__zoom-warning')).toBeNull()
  })

  test('does not warn about Contents-hidden datasets or summaries', () => {
    renderWarning({
      pluginState: {
        layers: [
          { id: 'grid', ready: true, hidden: true },
          { id: 'woodland', ready: true, minZoom: 10, hidden: true }
        ]
      }
    })

    expect(view.container.querySelector('.app-map__zoom-warning')).toBeNull()
    expect(services.announce).not.toHaveBeenCalled()
  })

  test('takes up no room when an enabled layer is drawn at its minimum zoom', () => {
    renderWarning({ zoom: 11, pluginState: { layers: [{ id: 'grid', ready: true }] } })

    expect(view.container.querySelector('.app-map__zoom-warning')).toBeNull()
    expect(services.announce).not.toHaveBeenCalled()
  })

  test('does not warn about an enabled dataset with no zoom floor', () => {
    renderWarning({
      pluginState: {
        layers: [{ id: 'woodland', ready: true, minZoom: undefined }]
      }
    })

    expect(view.container.querySelector('.app-map__zoom-warning')).toBeNull()
    expect(services.announce).not.toHaveBeenCalled()
  })
})
