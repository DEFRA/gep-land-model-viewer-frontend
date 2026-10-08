import { describe, test, expect } from 'vitest'
import { cellSizeAtZoom } from './resolution.js'

describe('#cellSizeAtZoom', () => {
  test.each([
    [13, 10],
    [11, 10],
    [10.99, 100],
    [8, 100],
    [7.99, 1000],
    [5, 1000],
    [4.99, 10000],
    [2, 10000],
    [1.99, 100000],
    [0, 100000]
  ])('at UK zoom %s uses %im cells', (zoom, cellSize) => {
    expect(cellSizeAtZoom(zoom)).toBe(cellSize)
  })
})
