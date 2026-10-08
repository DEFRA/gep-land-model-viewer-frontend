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
    const result = cellAtPoint([418725, 385137], 10)
    expect(result.cellId.formatted).toBe('SK 1872 8513')
    expect(result.cellId.compact).toBe('SK18728513')
    expect(result.easting).toBe(418720)
    expect(result.northing).toBe(385130)
  })

  test('returns exact coordinates when already on grid', () => {
    const result = cellAtPoint([418720, 385130], 10)
    expect(result.cellId.formatted).toBe('SK 1872 8513')
    expect(result.easting).toBe(418720)
    expect(result.northing).toBe(385130)
  })

  test('snaps coordinates just below cell boundary', () => {
    const result = cellAtPoint([418729.999, 385139.999], 10)
    expect(result.cellId.formatted).toBe('SK 1872 8513')
    expect(result.easting).toBe(418720)
    expect(result.northing).toBe(385130)
  })

  test('handles small coordinates near origin', () => {
    expect(cellAtPoint([0, 0], 10).cellId.formatted).toBe('SV 0000 0000')
    expect(cellAtPoint([5, 7], 10).cellId.formatted).toBe('SV 0000 0000')
  })

  test.each([
    [10, 466720, 475130, 'SE 6672 7513'],
    [100, 466700, 475100, 'SE 667 751'],
    [1000, 466000, 475000, 'SE 66 75'],
    [10000, 460000, 470000, 'SE 6 7'],
    [100000, 400000, 400000, 'SE']
  ])('snaps the SE67 test point to a %im cell', (size, easting, northing, reference) => {
    const cell = cellAtPoint([466725, 475137], size)

    expect(cell.easting).toBe(easting)
    expect(cell.northing).toBe(northing)
    expect(cell.cellId.formatted).toBe(reference)
  })

  test.each([10, 100, 1000, 10000, 100000])('returns null outside the BNG extent at %im', size => {
    expect(cellAtPoint([-1, 385130], size)).toBeNull()
    expect(cellAtPoint([418720, -1], size)).toBeNull()
    expect(cellAtPoint([700000, 385130], size)).toBeNull()
    expect(cellAtPoint([418720, 1300000], size)).toBeNull()
  })

  test.each([10, 100, 1000, 10000, 100000])('assigns a %im boundary to the cell to its north and east', size => {
    const before = cellAtPoint([500000 - 0.001, 400000 - 0.001], size)
    const atBoundary = cellAtPoint([500000, 400000], size)

    expect(before.easting).toBe(500000 - size)
    expect(before.northing).toBe(400000 - size)
    expect(atBoundary.easting).toBe(500000)
    expect(atBoundary.northing).toBe(400000)
  })
})
