import { describe, test, expect } from 'vitest'
import { toSource } from './model.js'

describe('toSource', () => {
  test('parses the supplier date', () => {
    expect(toSource('Natural England', '28/04/2015')).toEqual({ name: 'Natural England', updated: new Date(2015, 3, 28) })
  })

  test('keeps whichever of name and date is valid', () => {
    expect(toSource('Natural England', 'unknown')).toEqual({ name: 'Natural England' })
    expect(toSource('', '28/04/2026')).toEqual({ updated: new Date(2026, 3, 28) })
    expect(toSource(undefined, undefined)).toBeUndefined()
  })
})
