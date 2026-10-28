import { describe, test, expect } from 'vitest'
import { toDate } from './date.js'

describe('toDate', () => {
  test('parses the supplier date format', () => {
    expect(toDate('08/03/2023')).toEqual(new Date(2023, 2, 8))
  })

  test('parses a year for annual products', () => {
    expect(toDate('2024')).toEqual(new Date(2024, 0, 1))
  })

  test('parses an ISO timestamp', () => {
    expect(toDate('2026-10-21T10:47:51.297Z')).toEqual(new Date(Date.UTC(2026, 9, 21, 10, 47, 51, 297)))
  })

  test('rejects anything else', () => {
    expect(toDate('2023-03-08')).toBeNull()
    expect(toDate('24')).toBeNull()
    expect(toDate('')).toBeNull()
    expect(toDate(null)).toBeNull()
  })
})
