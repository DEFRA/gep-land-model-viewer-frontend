import { fireEvent } from '@testing-library/preact'

export function blurInput (input) {
  // Dispatch focusout so Preact's onBlur handler runs in jsdom.
  fireEvent(input, new FocusEvent('focusout', { bubbles: true }))
}
