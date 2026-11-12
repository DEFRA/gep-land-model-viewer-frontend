import { describe, test, expect } from 'vitest'
import { combineRecords } from './combine.js'

function record (overrides = {}) {
  return {
    unit: { kind: 'grid', bngRef: 'SE667751', cellSize: 100 },
    landCover: null,
    landUse: null,
    ownership: null,
    landManagement: null,
    protectedAreas: null,
    soils: null,
    ...overrides
  }
}

function units (area, records) {
  return records.map(record => ({ record, area }))
}

function theme (intersections, source) {
  return {
    dominant: { label: intersections[0][0] },
    intersections: intersections.map(([label, area]) => ({ label, area, percentage: area / 100 })),
    ...(source ? { source } : {})
  }
}

describe('#combineRecords', () => {
  test('combines classes by area against the selected squares\' total area', () => {
    const combined = combineRecords(units(10000, [
      record({ landCover: theme([['Woodland', 6000], ['Improved grass', 4000]]) }),
      record({ landCover: theme([['Improved grass', 10000]]) })
    ]))

    expect(combined.landCover).toEqual({
      dominant: { label: 'Improved grass' },
      intersections: [
        { label: 'Woodland', area: 6000, percentage: 30 },
        { label: 'Improved grass', area: 14000, percentage: 70 }
      ]
    })
  })

  test('counts uncovered area in the total', () => {
    const combined = combineRecords(units(10000, [
      record({ landUse: theme([['Agriculture', 5000]]) }),
      record()
    ]))

    expect(combined.landUse.intersections).toEqual([{ label: 'Agriculture', area: 5000, percentage: 25 }])
  })

  test('combines 10m squares by the share of squares where each class is dominant', () => {
    const tenMetre = (label, tenure) => record({
      soils: { dominant: { label } },
      ownership: { titles: [{ inspireId: '47540258', titleDescriptor: tenure }] }
    })

    const combined = combineRecords(units(100, [
      tenMetre('Brown soils', 'Freehold'),
      tenMetre('Brown soils', 'Freehold'),
      tenMetre('Peat', 'Leasehold')
    ]))

    expect(combined.soils).toEqual({
      dominant: { label: 'Brown soils' },
      intersections: [
        { label: 'Brown soils', area: 200, percentage: 66.7 },
        { label: 'Peat', area: 100, percentage: 33.3 }
      ]
    })
    expect(combined.ownership.tenureIntersections).toEqual([
      { label: 'Freehold', area: 200, percentage: 66.7 },
      { label: 'Leasehold', area: 100, percentage: 33.3 }
    ])
  })

  test('lists titles once and shares tenure by area, counting overlapping titles under each tenure', () => {
    const combined = combineRecords(units(10000, [
      record({
        ownership: {
          titles: [
            { inspireId: '1', titleDescriptor: 'Freehold', area: 9000 },
            { inspireId: '2', titleDescriptor: 'Leasehold', area: 5000 }
          ]
        }
      }),
      record({ ownership: { titles: [{ inspireId: '1', titleDescriptor: 'Freehold', area: 8000 }, { inspireId: '3', area: 1000 }] } })
    ]))

    expect(combined.ownership).toEqual({
      titles: [
        { inspireId: '1', titleDescriptor: 'Freehold' },
        { inspireId: '2', titleDescriptor: 'Leasehold' },
        { inspireId: '3' }
      ],
      tenureIntersections: [
        { label: 'Freehold', area: 17000, percentage: 85 },
        { label: 'Leasehold', area: 5000, percentage: 25 }
      ]
    })
  })

  test('lists pseudo SBIs once', () => {
    const combined = combineRecords(units(10000, [
      record({ landManagement: { records: [{ pseudoSbi: '107132256' }, { pseudoSbi: '107132257' }] } }),
      record({ landManagement: { records: [{ pseudoSbi: '107132257' }] } })
    ]))

    expect(combined.landManagement).toEqual({ records: [{ pseudoSbi: '107132256' }, { pseudoSbi: '107132257' }] })
  })

  test('shows whether any grid square contains a protected area', () => {
    const contains = counts => combineRecords(units(10000, counts.map(count => record({ protectedAreas: { count } })))).protectedAreas

    expect(contains([null, 2])).toEqual({ contains: true })
    expect(contains([0, 0])).toEqual({ contains: false })
  })

  test('leaves protected areas unavailable when a square without a count could contain one', () => {
    const combined = combineRecords(units(10000, [record({ protectedAreas: { count: 0 } }), record({ protectedAreas: { count: null } })]))

    expect(combined.protectedAreas).toBeNull()
    expect(combineRecords(units(10000, [record({ protectedAreas: { count: 0 } }), record()])).protectedAreas).toBeNull()
  })

  test('keeps the release\'s source', () => {
    const source = { name: 'Cranfield', updated: new Date('2024-01-01') }

    const combined = combineRecords(units(10000, [
      record(),
      record({ soils: theme([['Brown soils', 10000]], source) })
    ]))

    expect(combined.soils.source).toBe(source)
  })

  test('leaves themes that no record has unavailable', () => {
    const combined = combineRecords(units(10000, [null, record()]))

    expect(combined).toEqual({
      landCover: null,
      landUse: null,
      ownership: null,
      landManagement: null,
      protectedAreas: null,
      soils: null
    })
  })
})
