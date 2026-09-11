export const GOVUK_BLUE = '#1d70b8'
export const GOVUK_DARK_GREY = '#505a5f'
export const DEFRA_GREEN = '#008531'
export const DEFRA_GREEN_DARK = '#006a27'

export const RGBA_ALPHA_INDEX = 3

/** @typedef {[number, number, number]} RgbColour */
/** @typedef {[number, number, number, number]} RgbaColour */

/** @param {number[]} colour */
export function rgbaString (colour) {
  const [red, green, blue, alpha] = colour

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export function hexForColour (colour) {
  return `#${colour.map(value => value.toString(16).padStart(2, '0')).join('')}`
}

export function normaliseHex (value) {
  const hex = value.trim().replace(/^#/, '')
  if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(hex)) {
    return null
  }

  const expanded = hex.length === 3 ? [...hex].map(character => character.repeat(2)).join('') : hex
  return `#${expanded.toLowerCase()}`
}

/**
 * Converts a normalised '#rrggbb' colour to RGB.
 * @returns {RgbColour}
 */
export function colourForHex (hex) {
  const red = Number.parseInt(hex.slice(1, 3), 16)
  const green = Number.parseInt(hex.slice(3, 5), 16)
  const blue = Number.parseInt(hex.slice(5, 7), 16)

  return [red, green, blue]
}

/** rgba() string for a '#rrggbb' palette colour at the given opacity */
export function withAlpha (hexColour, alpha) {
  return rgbaString([...colourForHex(hexColour), alpha])
}
