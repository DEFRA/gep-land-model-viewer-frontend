import { toBngRef, BngReference } from './bng-reference.js'

describe('#toBngRef', () => {
  test('returns a BngReference', () => {
    expect(toBngRef(523863, 134729, 10)).toBeInstanceOf(BngReference)
  })

  test('resolves the correct prefix for different grid squares', () => {
    expect(toBngRef(430000, 380000, 100000).compact).toBe('SK')
    expect(toBngRef(330000, 510000, 100000).compact).toBe('NY')
    expect(toBngRef(90000, 10000, 100000).compact).toBe('SV')
    expect(toBngRef(651000, 312000, 100000).compact).toBe('TG')
  })

  test('digit count matches resolution', () => {
    expect(toBngRef(523863, 134729, 1).formatted).toBe('TQ 23863 34729')
    expect(toBngRef(523863, 134729, 10).formatted).toBe('TQ 2386 3472')
    expect(toBngRef(523863, 134729, 100).formatted).toBe('TQ 238 347')
    expect(toBngRef(523863, 134729, 1000).formatted).toBe('TQ 23 34')
    expect(toBngRef(523863, 134729, 10000).formatted).toBe('TQ 2 3')
    expect(toBngRef(523863, 134729, 100000).formatted).toBe('TQ')
  })

  test('zero-pads short easting and northing values', () => {
    const ref = toBngRef(500050, 100030, 10)
    expect(ref.formatted).toBe('TQ 0005 0003')
    expect(ref.compact).toBe('TQ00050003')
  })

  test('handles origin and upper extent', () => {
    expect(toBngRef(0, 0, 10).formatted).toBe('SV 0000 0000')
    expect(toBngRef(699990, 1299990, 10).formatted).toBe('JM 9999 9999')
  })

  test('returns null for coordinates outside the BNG extent', () => {
    expect(toBngRef(-1, 0, 10)).toBeNull()
    expect(toBngRef(0, -1, 10)).toBeNull()
    expect(toBngRef(700000, 0, 10)).toBeNull()
    expect(toBngRef(0, 1300000, 10)).toBeNull()
  })
})

describe('BngReference', () => {
  test('toString returns formatted representation', () => {
    expect(`${toBngRef(523863, 134729, 10)}`).toBe('TQ 2386 3472')
  })

  test('100km resolution returns prefix only for both formats', () => {
    const ref = toBngRef(523863, 134729, 100000)
    expect(ref.compact).toBe('TQ')
    expect(ref.formatted).toBe('TQ')
  })
})
