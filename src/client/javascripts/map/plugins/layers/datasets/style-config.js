import { RGBA_ALPHA_INDEX, rgbaString } from '../../../config/colours.js'

const TRANSPARENT = [0, 0, 0, 0]

function fillFor (definition) {
  return definition?.visible === false ? TRANSPARENT : definition?.fill ?? TRANSPARENT
}

function strokeFor (definition) {
  return definition?.visible === false ? undefined : definition?.stroke
}

function strokeColourFor (definition) {
  return strokeFor(definition)?.color ?? TRANSPARENT
}

function strokeWidthFor (definition) {
  return strokeFor(definition)?.width ?? 0
}

function hasStroke (styleConfig) {
  return [...styleConfig.classes, styleConfig.default].some(definition => strokeFor(definition) !== undefined)
}

/**
 * Returns whether a COG stores class codes rather than source range values.
 *
 * @param {object} styleConfig Style config
 * @returns {boolean} Whether band values are required for COG rendering
 */
function isClassCodedCog (styleConfig) {
  return styleConfig.type !== 'range' || styleConfig.classes[0].bandValue !== undefined
}

function classCodedDefinitions (styleConfig) {
  return styleConfig.default?.bandValue === undefined
    ? styleConfig.classes
    : [...styleConfig.classes, styleConfig.default]
}

/**
 * Builds a WebGL tile colour expression for a class-coded or source-value COG.
 *
 * @param {object} styleConfig Style config
 * @returns {import('ol/expr/expression.js').EncodedExpression}
 */
export function buildCogColourExpression (styleConfig) {
  /** @type {import('ol/expr/expression.js').EncodedExpression[]} */
  const branches = ['case']
  // Generated COGs have one data band; OpenLayers handles their nodata alpha.
  const band = ['band', 1]

  if (styleConfig.type === 'range' && !isClassCodedCog(styleConfig)) {
    branches.push(['<', band, styleConfig.minValue], fillFor(styleConfig.default))
    for (const definition of styleConfig.classes) {
      branches.push(['<=', band, definition.maxValue], fillFor(definition))
    }
    branches.push(fillFor(styleConfig.default))
  } else {
    for (const definition of classCodedDefinitions(styleConfig)) {
      branches.push(['==', band, definition.bandValue], fillFor(definition))
    }
    branches.push(TRANSPARENT)
  }

  return branches
}

function matchExpressionFor (styleConfig, valueFor) {
  /** @type {import('ol/expr/expression.js').EncodedExpression[]} */
  const expression = ['match', ['get', styleConfig.field]]
  for (const definition of styleConfig.classes) {
    for (const fieldValue of definition.fieldValues) {
      expression.push(fieldValue, valueFor(definition))
    }
  }
  expression.push(valueFor(styleConfig.default))
  return expression
}

function rangeExpressionFor (styleConfig, valueFor) {
  if (styleConfig.field === undefined) {
    throw new Error('A range style config needs a field for vector rendering')
  }

  /** @type {import('ol/expr/expression.js').EncodedExpression[]} */
  const value = ['get', styleConfig.field]
  /** @type {import('ol/expr/expression.js').EncodedExpression[]} */
  const expression = ['case', ['<', value, styleConfig.minValue], valueFor(styleConfig.default)]
  for (const definition of styleConfig.classes) {
    expression.push(['<=', value, definition.maxValue], valueFor(definition))
  }
  expression.push(valueFor(styleConfig.default))
  return expression
}

function vectorExpressionFor (styleConfig, valueFor) {
  if (styleConfig.type === 'uniform') {
    return valueFor(styleConfig.classes[0])
  }
  if (styleConfig.type === 'match') {
    return matchExpressionFor(styleConfig, valueFor)
  }
  return rangeExpressionFor(styleConfig, valueFor)
}

/**
 * Builds an OpenLayers flat style from the class table.
 *
 * @param {object} styleConfig Style config
 * @returns {import('ol/style/flat.js').FlatStyle}
 */
export function buildVectorStyle (styleConfig) {
  const style = {
    'fill-color': vectorExpressionFor(styleConfig, fillFor)
  }

  if (hasStroke(styleConfig)) {
    style['stroke-color'] = vectorExpressionFor(styleConfig, strokeColourFor)
    style['stroke-width'] = vectorExpressionFor(styleConfig, strokeWidthFor)
  }

  return style
}

function variableName (classIndex, part) {
  const prefix = classIndex === undefined ? 'default' : `class_${classIndex}`
  return `${prefix}_${part}`
}

/**
 * Complete colour values, including defaults, for an existing vector renderer.
 * @param {object} styleConfig Effective dataset style config
 * @returns {import('ol/style/flat.js').StyleVariables}
 */
export function buildColourVariables (styleConfig) {
  /** @type {import('ol/style/flat.js').StyleVariables} */
  const variables = {}
  // Use CSS strings so OpenLayers recognises these variables as colours.
  for (const { classIndex, definition } of editableStyleEntries(styleConfig)) {
    if (hasVisibleFill(definition)) {
      variables[variableName(classIndex, 'fill')] = rgbaString(definition.fill)
    }
    if (hasVisibleStroke(definition)) {
      variables[variableName(classIndex, 'stroke')] = rgbaString(definition.stroke.color)
    }
  }
  return variables
}

function definitionWithVariables (definition, classIndex, variables) {
  if (!definition) {
    return definition
  }

  const fillName = variableName(classIndex, 'fill')
  const strokeName = variableName(classIndex, 'stroke')
  return {
    ...definition,
    ...(fillName in variables && { fill: ['var', fillName] }),
    ...(strokeName in variables && {
      stroke: { ...definition.stroke, color: ['var', strokeName] }
    })
  }
}

/**
 * Build vector colour expressions with variables so edits avoid rebuilding the renderer.
 * @param {object} styleConfig Dataset style config
 */
export function buildVectorStyleWithVariables (styleConfig) {
  const variables = buildColourVariables(styleConfig)
  const config = {
    ...styleConfig,
    classes: styleConfig.classes.map((definition, index) => definitionWithVariables(definition, index, variables)),
    default: definitionWithVariables(styleConfig.default, undefined, variables)
  }

  return { style: buildVectorStyle(config), variables }
}

function rangeClassForValue (styleConfig, value) {
  const numericValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numericValue) || numericValue < styleConfig.minValue) {
    return styleConfig.default ?? null
  }

  return styleConfig.classes.find(definition => numericValue <= definition.maxValue) ??
    styleConfig.default ??
    null
}

function definitionForFieldValue (styleConfig, value) {
  if (styleConfig.type === 'uniform') {
    return styleConfig.classes[0]
  }
  if (styleConfig.type === 'range') {
    return rangeClassForValue(styleConfig, value)
  }
  if (value === undefined || value === null) {
    return styleConfig.default ?? null
  }

  const fieldValue = String(value)
  return styleConfig.classes.find(definition => definition.fieldValues.includes(fieldValue)) ??
    styleConfig.default ??
    null
}

export function hasVisibleFill (definition) {
  return definition?.visible !== false && definition?.fill?.[RGBA_ALPHA_INDEX] > 0
}

export function hasVisibleStroke (definition) {
  const stroke = strokeFor(definition)
  return stroke?.color?.[RGBA_ALPHA_INDEX] > 0 && stroke.width > 0
}

export function editableStyleEntries (styleConfig) {
  if (!styleConfig) {
    return []
  }

  return [
    ...styleConfig.classes.map((definition, classIndex) => ({ key: `class:${classIndex}`, classIndex, definition })),
    { key: 'default', classIndex: undefined, definition: styleConfig.default }
  ].filter(({ definition }) => hasVisibleFill(definition) || hasVisibleStroke(definition))
}

/**
 * Finds the visible class drawn for a vector field value.
 *
 * @param {object} styleConfig Style config
 * @param {*} value Feature field value
 * @returns {object|null} The visible class/default definition
 */
export function visibleClassForFieldValue (styleConfig, value) {
  const definition = definitionForFieldValue(styleConfig, value)
  if (definition && (hasVisibleFill(definition) || hasVisibleStroke(definition))) {
    return definition
  }
  return null
}

/**
 * Looks up the class or default definition for a COG data value.
 *
 * @param {object} styleConfig Style config
 * @param {number} value Class code or source range value
 * @returns {object|null} The class/default definition, or null when unmatched
 */
export function classForCogValue (styleConfig, value) {
  if (styleConfig.type === 'range' && !isClassCodedCog(styleConfig)) {
    return rangeClassForValue(styleConfig, value)
  }

  return classCodedDefinitions(styleConfig)
    .find(definition => definition.bandValue === value) ?? null
}

/**
 * Finds the visible class drawn for a single-band COG pixel. OpenLayers
 * appends a mask band that decides whether the pixel is drawn at all.
 *
 * @param {object} styleConfig Style config
 * @param {ArrayLike<number>|null|undefined} bands Pixel band values
 * @returns {object|null} The visible class/default definition
 */
export function visibleClassForBands (styleConfig, bands) {
  if (!bands?.length) {
    return null
  }

  if (bands.length > 1 && !bands[bands.length - 1]) {
    return null
  }

  const value = bands[0]
  if (value === undefined || value === null) {
    return null
  }

  const definition = classForCogValue(styleConfig, value)
  return definition && hasVisibleFill(definition) ? definition : null
}
