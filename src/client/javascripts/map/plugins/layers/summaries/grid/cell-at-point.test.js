import { cellAtPoint, snapDown, snapUp } from './cell-at-point.js'

describe('#snapDown', () => {
  test('snaps value down to nearest step', () => {
    expect(snapDown(25, 10)).toBe(20)
    expect(snapDown(29, 10)).toBe(20)
    expect(snapDown(30, 10)).toBe(30)
  })

  test('returns exact value when already on step', () => {
    expect(snapDown(100, 10)).toBe(100)
    expect(snapDown(0, 10)).toBe(0)
  })

  test('handles different step sizes', () => {
    expect(snapDown(17, 5)).toBe(15)
    expect(snapDown(99, 50)).toBe(50)
  })
})

describe('#snapUp', () => {
  test('snaps value up to nearest step', () => {
    expect(snapUp(21, 10)).toBe(30)
    expect(snapUp(25, 10)).toBe(30)
    expect(snapUp(30, 10)).toBe(30)
  })

  test('returns exact value when already on step', () => {
    expect(snapUp(100, 10)).toBe(100)
    expect(snapUp(0, 10)).toBe(0)
  })

  test('handles different step sizes', () => {
    expect(snapUp(17, 5)).toBe(20)
    expect(snapUp(51, 50)).toBe(100)
  })
})

describe('#cellAtPoint', () => {
  test('snaps coordinates to 10m grid and returns BNG reference', () => {
    const result = cellAtPoint([418725, 385137])
    expect(result.cellId.formatted).toBe('SK 1872 8513')
    expect(result.cellId.compact).toBe('SK18728513')
    expect(result.easting).toBe(418720)
    expect(result.northing).toBe(385130)
  })

  test('returns exact coordinates when already on grid', () => {
    const result = cellAtPoint([418720, 385130])
    expect(result.cellId.formatted).toBe('SK 1872 8513')
    expect(result.easting).toBe(418720)
    expect(result.northing).toBe(385130)
  })

  test('snaps coordinates just below cell boundary', () => {
    const result = cellAtPoint([418729.999, 385139.999])
    expect(result.cellId.formatted).toBe('SK 1872 8513')
    expect(result.easting).toBe(418720)
    expect(result.northing).toBe(385130)
  })

  test('handles small coordinates near origin', () => {
    expect(cellAtPoint([0, 0]).cellId.formatted).toBe('SV 0000 0000')
    expect(cellAtPoint([5, 7]).cellId.formatted).toBe('SV 0000 0000')
  })

  test('returns null for coordinates outside the BNG extent', () => {
    expect(cellAtPoint([-1, 385130])).toBeNull()
    expect(cellAtPoint([418720, -1])).toBeNull()
  })
})
