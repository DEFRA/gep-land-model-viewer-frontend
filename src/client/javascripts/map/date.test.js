import { describe, test, expect } from 'vitest'
import { toDate } from './date.js'

describe('toDate', () => {
  test('parses the supplier date format', () => {
    expect(toDate('08/03/2023')).toEqual(new Date(2023, 2, 8))
  })

  test('rejects anything else', () => {
    expect(toDate('2023-03-08')).toBeNull()
    expect(toDate('')).toBeNull()
    expect(toDate(null)).toBeNull()
  })
})
