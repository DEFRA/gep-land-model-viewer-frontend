import { hasVisibleFill, hasVisibleStroke } from '../../datasets/style-config.js'

/**
 * @typedef {object} StyleDefinition
 * @property {string} [label]
 * @property {number[]} [fill] RGBA colour
 * @property {{ color: number[], width: number }} [stroke]
 * @property {boolean} [visible]
 */

const MINIMUM_SWATCH_STROKE_WIDTH = 2

/** @returns {StyleDefinition[]} */
export function visibleStyleDefinitions (styleConfig) {
  return [...styleConfig.classes, styleConfig.default]
    .filter(definition => definition && (hasVisibleFill(definition) || hasVisibleStroke(definition)))
}

/** @param {number[]} colour */
export function rgbaString (colour) {
  const [red, green, blue, alpha] = colour

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

/** @param {StyleDefinition} definition */
export function swatchStyle (definition) {
  const { fill = [0, 0, 0, 0], stroke } = definition

  return {
    backgroundColor: rgbaString(fill),
    ...(hasVisibleStroke(definition)
      ? {
          borderColor: rgbaString(stroke.color),
          borderWidth: `${Math.max(stroke.width, MINIMUM_SWATCH_STROKE_WIDTH)}px`
        }
      : {})
  }
}

export function swatchColours (styleConfig) {
  const colours = []
  const seen = new Set()

  for (const definition of visibleStyleDefinitions(styleConfig)) {
    const colour = hasVisibleFill(definition) ? definition.fill : definition.stroke.color
    const key = colour.join(',')
    if (!seen.has(key)) {
      seen.add(key)
      colours.push(colour)
    }
  }

  return colours
}
