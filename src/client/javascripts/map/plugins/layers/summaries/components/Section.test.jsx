// @vitest-environment jsdom
import { describe, test, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/preact'
import { InfoPanelContext } from '../../panels/info/context.js'
import { Section } from './Section.jsx'

function mount (sections, title = 'Soils') {
  return render(
    <InfoPanelContext.Provider value={{ sections }}>
      <Section sectionKey='soils' title={title} preview='Brown soils'>content</Section>
    </InfoPanelContext.Provider>
  )
}

describe('Section', () => {
  test('remembers a closed section by key, not title', () => {
    const sections = new Map()
    const first = mount(sections)
    const details = first.container.querySelector('details')
    expect(details.open).toBe(true)
    details.open = false
    fireEvent(details, new Event('toggle'))
    expect(sections.get('soils')).toBe(false)
    first.unmount()

    const second = mount(sections, 'Soil information')
    expect(second.container.querySelector('details').open).toBe(false)
    second.unmount()
  })

  test('shows the preview and links to the guide', () => {
    const view = mount(new Map())
    expect(view.container.querySelector('summary').textContent).toBe('SoilsBrown soils')
    const link = view.getByRole('link', { name: /Soil definitions/ })
    expect(link.getAttribute('href')).toBe('/land-model/gep-land-model.pdf#page=29')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    view.unmount()
  })
})
