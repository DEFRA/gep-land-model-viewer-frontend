import { describe, test, expect } from 'vitest'
import {
  EMPTY,
  formatDate
} from './format.js'

describe('formatDate', () => {
  test('renders ISO order, or a dash when there is no date', () => {
    expect(formatDate(new Date(2023, 2, 8))).toBe('2023-03-08')
    expect(formatDate(null)).toBe(EMPTY)
  })
})
