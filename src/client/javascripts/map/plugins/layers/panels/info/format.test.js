import { describe, test, expect } from 'vitest'
import {
  EMPTY,
  formatDate,
  formatDatasetDate
} from './format.js'

describe('formatDate', () => {
  test('renders ISO order, or a dash when there is no date', () => {
    expect(formatDate(new Date(2023, 2, 8))).toBe('2023-03-08')
    expect(formatDate(null)).toBe(EMPTY)
  })
})

describe('formatDatasetDate', () => {
  test('formats an ISO date for the dataset information panel', () => {
    expect(formatDatasetDate('2026-03-15')).toBe('15 March 2026')
  })

  test('shows a placeholder for missing or invalid dates', () => {
    expect(formatDatasetDate(null)).toBe(EMPTY)
    expect(formatDatasetDate('unknown')).toBe(EMPTY)
    expect(formatDatasetDate('2026-13-99')).toBe(EMPTY)
  })
})
