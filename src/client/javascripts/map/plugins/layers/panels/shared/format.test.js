import { describe, test, expect } from 'vitest'
import {
  EMPTY,
  formatDatasetDate,
  formatResolution
} from './format.js'

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

describe('formatResolution', () => {
  test.each([
    ['1:250,000', { scaleDenominators: [250000], distances: [] }],
    ['1:10,000', { scaleDenominators: [10000], distances: [] }],
    ['2m', { scaleDenominators: [], distances: ['2 m'] }],
    ['2m', { scaleDenominators: [], distances: ['  2 m  '] }],
    ['0.5m', { scaleDenominators: [], distances: ['0.5 m'] }],
    ['1:250,000, 2m', { scaleDenominators: [250000], distances: ['2 m'] }],
    [EMPTY, null]
  ])('formats resolution as "%s"', (expected, resolution) => {
    expect(formatResolution(resolution)).toBe(expected)
  })
})
