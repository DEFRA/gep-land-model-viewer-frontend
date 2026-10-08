import { describe, test, expect } from 'vitest'
import { formatUpdatedYear, formatGridSize, formatCount } from './format.js'

describe('summary formatting', () => {
  test('displays the year of the update date', () => {
    expect(formatUpdatedYear(new Date(2023, 2, 8))).toBe('2023')
  })

  test.each([[10, '10m x 10m'], [100, '100m x 100m'], [1000, '1km x 1km'], [10000, '10km x 10km'], [100000, '100km x 100km']])('formats %i as %s', (size, expected) => {
    expect(formatGridSize(size)).toBe(expected)
  })

  test.each([[undefined, 'Not available'], [null, 'Not available'], [0, 'None'], [1, '1 title'], [2, '2 titles']])('formats a count of %s as %s', (count, expected) => {
    expect(formatCount(count, 'title', 'titles')).toBe(expected)
  })
})
