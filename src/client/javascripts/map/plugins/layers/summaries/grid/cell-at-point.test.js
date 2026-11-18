import Polygon, { fromExtent } from 'ol/geom/Polygon.js'
import { cellAtPoint, cellsInPolygon, snapDown, snapUp } from './cell-at-point.js'

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

describe('#cellsInPolygon', () => {
  const refs = cells => cells.map(({ cellId }) => cellId.compact).sort()

  test('selects the cells inside the polygon and those crossing its edge', () => {
    const polygon = fromExtent([460005, 470005, 460025, 470015])

    expect(refs(cellsInPolygon(polygon, 10))).toEqual([
      'SE60007000', 'SE60007001', 'SE60017000', 'SE60017001', 'SE60027000', 'SE60027001'
    ])
  })

  test('leaves out cells in the polygon\'s extent that it does not overlap', () => {
    // a triangle over the bottom-left half of a 2 x 2 block
    const polygon = new Polygon([[[460000, 470000], [460019, 470000], [460000, 470019], [460000, 470000]]])

    expect(refs(cellsInPolygon(polygon, 10))).toEqual(['SE60007000', 'SE60007001', 'SE60017000'])
  })

  test('a polygon on the grid lines selects only the cells it covers, not those sharing its edges', () => {
    const square = fromExtent([460010, 470010, 460020, 470020])
    // an L over a 3 x 3 block: the left column and the bottom row
    const lShape = new Polygon([[
      [460000, 470000], [460030, 470000], [460030, 470010], [460010, 470010],
      [460010, 470030], [460000, 470030], [460000, 470000]
    ]])

    expect(refs(cellsInPolygon(square, 10))).toEqual(['SE60017001'])
    expect(refs(cellsInPolygon(lShape, 10))).toEqual([
      'SE60007000', 'SE60007001', 'SE60007002', 'SE60017000', 'SE60027000'
    ])
  })

  test('selects cells at the given size', () => {
    const polygon = fromExtent([460500, 470500, 461500, 470900])

    expect(refs(cellsInPolygon(polygon, 1000))).toEqual(['SE6070', 'SE6170'])
  })

  test('leaves out cells beyond the grid', () => {
    const polygon = fromExtent([-15, 5, 5, 15])

    expect(refs(cellsInPolygon(polygon, 10))).toEqual(['SV00000000', 'SV00000001'])
  })
})
