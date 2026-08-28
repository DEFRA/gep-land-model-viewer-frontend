// @vitest-environment jsdom
import { vi, describe, test, expect } from 'vitest'
import { render } from '@testing-library/preact'
import { InfoPanelContext } from './context.js'
import { Unavailable } from './Unavailable.jsx'
import { SummaryList } from './SummaryList.jsx'

const goToSampleArea = vi.fn()

function mount (children = null) {
  return render(
    <InfoPanelContext.Provider value={{ sections: new Map(), goToSampleArea }}>
      <Unavailable typeLabel='grid cell'>
        {children}
      </Unavailable>
    </InfoPanelContext.Provider>
  )
}

let view

describe('Unavailable', () => {
  test('names what was clicked above the notice', () => {
    view = mount(<SummaryList className='app-map__info-ids' rows={[{ label: 'Grid square', value: 'SK 1872 8513' }]} />)

    expect(view.container.textContent).toContain('SK 1872 8513')
    expect(view.container.textContent).toContain('This grid cell is not covered by the sample land model.')
  })

  test('the sample area control is a button that moves the map', () => {
    view = mount()
    const control = view.container.querySelector('button')

    expect(control.type).toBe('button')
    expect(view.container.querySelector('a')).toBeNull()

    control.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(goToSampleArea).toHaveBeenCalled()
  })
})
