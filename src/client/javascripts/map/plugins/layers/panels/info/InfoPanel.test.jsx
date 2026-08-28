// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/preact'
import { InfoPanel } from './InfoPanel.jsx'
import { Section } from './Section.jsx'

const map = {
  getView: () => ({ setCenter: vi.fn(), setZoom: vi.fn() })
}

const INITIAL_INSPECTION = {
  status: 'idle',
  hits: [],
  hit: null
}

function hit (label, id = 0) {
  return { id, label, details: { label } }
}

function click (element) {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

let view
let selectHit
let showHitList
let renderHit

function renderPanel (inspection = INITIAL_INSPECTION, { sections = new Map(), panelMap = map } = {}) {
  const refs = {
    inspection: { current: { selectHit, showHitList, renderHit } },
    inspectionSections: { current: sections }
  }
  const pluginState = {
    inspection,
    useRef: key => refs[key]
  }

  view = render(<InfoPanel pluginState={pluginState} mapProvider={{ map: panelMap }} />)
  return view
}

beforeEach(() => {
  selectHit = vi.fn()
  showHitList = vi.fn()
  renderHit = vi.fn(selectedHit => <p>{selectedHit.details.label} body</p>)
})

describe('InfoPanel', () => {
  test('renders nothing before the first click', () => {
    renderPanel()

    expect(view.container.querySelector('.app-map__info-panel').textContent).toBe('')
  })

  test('marks the panel busy while details load', () => {
    renderPanel({ ...INITIAL_INSPECTION, status: 'searching' })

    expect(view.container.querySelector('.app-map__info-panel').getAttribute('aria-busy')).toBe('true')
    expect(view.container.textContent).toContain('Loading details...')
  })

  test('reports a click that found nothing', () => {
    renderPanel({ ...INITIAL_INSPECTION, status: 'empty' })

    expect(view.container.textContent).toContain('No information found at this location.')
  })

  test('lists several hits and delegates selection', () => {
    const hits = [hit('Grid square'), hit('OS feature', 1)]
    renderPanel({ ...INITIAL_INSPECTION, status: 'list', hits })

    const buttons = [...view.container.querySelectorAll('.app-map__info-hit')]
    expect(buttons.map(button => button.textContent.trim())).toEqual(['Grid square', 'OS feature'])

    click(buttons[1])
    expect(selectHit).toHaveBeenCalledWith(hits[1])
  })

  test('renders a lone selected hit without a Back link', () => {
    const hits = [hit('Grid square')]
    renderPanel({ ...INITIAL_INSPECTION, status: 'detail-ready', hits, hit: hits[0] })

    expect(view.container.textContent).toContain('Grid square body')
    expect(renderHit).toHaveBeenCalledWith(hits[0])
    expect(view.container.querySelector('.app-map__info-back')).toBeNull()
  })

  test('offers a way back when the hit came from a list', () => {
    const hits = [hit('Grid square'), hit('OS feature', 1)]
    renderPanel({ ...INITIAL_INSPECTION, status: 'detail-ready', hits, hit: hits[0] })

    const back = view.container.querySelector('.app-map__info-back')
    expect(back.textContent).toContain('Back to 2 selected')

    click(back)
    expect(showHitList).toHaveBeenCalled()
  })

  test('shows a retry message when hit details fail', () => {
    const hits = [hit('Grid square')]
    renderPanel({ ...INITIAL_INSPECTION, status: 'detail-error', hits, hit: hits[0] })

    expect(view.container.textContent).toContain('Could not load details. Try selecting again.')
  })

  test('keeps section state when the same panel instance is rebuilt', () => {
    const sections = new Map()
    const selectedHit = hit('Grid square')
    renderHit.mockReturnValue(<Section title='Land cover'>Section body</Section>)
    const inspection = { ...INITIAL_INSPECTION, status: 'detail-ready', hits: [selectedHit], hit: selectedHit }

    renderPanel(inspection, { sections })
    const details = /** @type {HTMLDetailsElement} */ (view.container.querySelector('details'))
    details.open = true
    details.dispatchEvent(new Event('toggle'))

    view.unmount()
    renderPanel(inspection, { sections })
    expect(view.container.querySelector('details').open).toBe(true)

    view.unmount()
    renderPanel(inspection)
    expect(view.container.querySelector('details').open).toBe(false)
  })

  test('the sample area control recentres the map', async () => {
    const setCenter = vi.fn()
    const setZoom = vi.fn()
    const sampleMap = { getView: () => ({ setCenter, setZoom }) }
    const { Unavailable } = await import('./Unavailable.jsx')
    const selectedHit = {
      id: 0,
      label: 'Grid square',
      details: null
    }
    renderHit.mockReturnValue(<Unavailable typeLabel='grid cell'>{null}</Unavailable>)
    const inspection = { ...INITIAL_INSPECTION, status: 'detail-ready', hits: [selectedHit], hit: selectedHit }
    renderPanel(inspection, { panelMap: sampleMap })

    click(view.container.querySelector('.app-link-button'))
    expect(setCenter).toHaveBeenCalledWith([465000, 475000])
    expect(setZoom).toHaveBeenCalledWith(11)
  })
})
