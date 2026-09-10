import { describe, expect, test } from 'vitest'
import { colourForHex, hexForColour, normaliseHex, rgbaString, withAlpha } from './colours.js'

describe('colour conversions', () => {
  test.each([
    ['#000000', [0, 0, 0]],
    ['#ffffff', [255, 255, 255]],
    ['#0180ff', [1, 128, 255]]
  ])('converts %s between normalised hex and RGB', (hex, colour) => {
    expect(colourForHex(hex)).toEqual(colour)
    expect(hexForColour(colour)).toBe(hex)
  })

  test('formats RGBA without losing fractional or zero alpha', () => {
    expect(rgbaString([1, 128, 255, 0.42])).toBe('rgba(1, 128, 255, 0.42)')
    expect(withAlpha('#0180ff', 0)).toBe('rgba(1, 128, 255, 0)')
  })
})

describe('hex input normalisation', () => {
  test.each([
    ['F0a', '#ff00aa'],
    [' #01abEF ', '#01abef']
  ])('normalises %s to six lowercase digits with a hash', (value, expected) => {
    expect(normaliseHex(value)).toBe(expected)
  })

  test('rejects incomplete, overlong and non-hex values', () => {
    for (const value of ['', '#12', '#1234', '#12345', '#1234567', '#gggggg']) {
      expect(normaliseHex(value)).toBeNull()
    }
  })
})
