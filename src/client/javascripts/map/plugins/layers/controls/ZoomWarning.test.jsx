// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/preact'
import { ZoomWarning } from './ZoomWarning.jsx'

const DATASETS = [{ id: 'woodland', label: 'Ancient Woodland' }]

let view
let services

function renderWarning (props = {}) {
  const pluginState = { datasets: {}, summaries: {}, ...props.pluginState }
  view = render(
    <ZoomWarning
      mapState={{ zoom: props.zoom ?? 8 }}
      pluginConfig={{ datasets: DATASETS }}
      pluginState={pluginState}
      services={services}
    />
  )
  return view
}

beforeEach(() => {
  services = { announce: vi.fn() }
})

describe('ZoomWarning', () => {
  test('warns when an enabled summary is not drawn at this zoom, and announces it', () => {
    renderWarning({ pluginState: { summaries: { grid: true } } })

    expect(view.container.querySelector('.app-map__zoom-warning').textContent).toBe('Zoom in to see Grid squares')
    expect(services.announce).toHaveBeenCalledWith('Zoom in to see Grid squares')
  })

  test('warns about a dataset that has a zoom floor', () => {
    renderWarning({ pluginState: { datasets: { woodland: { visible: true, minZoom: 10 } } } })

    expect(view.container.querySelector('.app-map__zoom-warning').textContent).toBe('Zoom in to see Ancient Woodland')
  })

  test('groups several out-of-range layers into one warning', () => {
    renderWarning({
      pluginState: {
        summaries: { grid: true },
        datasets: { woodland: { visible: true, minZoom: 10 } }
      }
    })

    expect(view.container.querySelector('.app-map__zoom-warning').textContent).toBe('Zoom in to see the selected data layers')
    expect(services.announce).toHaveBeenCalledWith('Zoom in to see the selected data layers')
  })

  test('does not warn about a hidden dataset retaining its previous zoom floor', () => {
    renderWarning({ pluginState: { datasets: { woodland: { visible: false, loading: true, minZoom: 10 } } } })

    expect(view.container.querySelector('.app-map__zoom-warning')).toBeNull()
  })

  test('takes up no room when an enabled layer is drawn at its minimum zoom', () => {
    renderWarning({ zoom: 11, pluginState: { summaries: { grid: true } } })

    expect(view.container.querySelector('.app-map__zoom-warning')).toBeNull()
    expect(services.announce).not.toHaveBeenCalled()
  })

  test('does not warn about an enabled dataset with no zoom floor', () => {
    renderWarning({ pluginState: { datasets: { woodland: { visible: true, minZoom: undefined } } } })

    expect(view.container.querySelector('.app-map__zoom-warning')).toBeNull()
    expect(services.announce).not.toHaveBeenCalled()
  })
})
