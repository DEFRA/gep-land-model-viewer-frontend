// @vitest-environment jsdom
import { vi, describe, test, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/preact'
import { InfoPanelContext } from '../../panels/info/context.js'
import { OutsideSampleArea } from './OutsideSampleArea.jsx'

describe('OutsideSampleArea', () => {
  test('offers a button to go to the sample area', () => {
    const goToSampleArea = vi.fn()
    const view = render(
      <InfoPanelContext.Provider value={{ goToSampleArea }}>
        <OutsideSampleArea typeLabel='grid square' />
      </InfoPanelContext.Provider>
    )
    expect(view.container.textContent).toContain('This grid square is not covered by the sample land model.')
    const control = view.getByRole('button', { name: 'Go to the sample area' })
    expect(control.type).toBe('button')
    fireEvent.click(control)
    expect(goToSampleArea).toHaveBeenCalledOnce()
    view.unmount()
  })
})
