// @vitest-environment jsdom
import { describe, test, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/preact'
import { InfoPanelContext } from './context.js'
import { Section } from './Section.jsx'

let sections

beforeEach(() => {
  sections = new Map()
})

function mount (open) {
  return render(
    <InfoPanelContext.Provider value={{ sections, goToSampleArea: () => {} }}>
      <Section title='Soils' open={open}>content</Section>
    </InfoPanelContext.Provider>
  )
}

describe('Section', () => {
  test('opens closed by default and shows the title', () => {
    const { container } = mount()
    const details = container.querySelector('details')

    expect(details.open).toBe(false)
    expect(container.querySelector('.app-map__info-section-title').textContent).toBe('Soils')
  })

  test('remembers the expanded state for the next time the panel is rebuilt', () => {
    const first = mount()
    const details = first.container.querySelector('details')

    details.open = true
    details.dispatchEvent(new Event('toggle'))
    first.unmount()

    const second = mount()
    expect(second.container.querySelector('details').open).toBe(true)
  })

  test('remembers a section the user collapsed against a markup default of open', () => {
    const first = mount(true)
    const details = first.container.querySelector('details')

    details.open = false
    details.dispatchEvent(new Event('toggle'))
    first.unmount()

    const second = mount(true)
    expect(second.container.querySelector('details').open).toBe(false)
  })
})
