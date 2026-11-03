import { RGBA_ALPHA_INDEX } from '../../../config/colours.js'

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
 * @param {object} styleConfig Resolved style theme
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
 * Builds a WebGL tile colour expression for a uniform, class-coded or source-value COG.
 *
 * @param {object} styleConfig Resolved style theme
 * @returns {import('ol/expr/expression.js').EncodedExpression}
 */
export function buildCogColourExpression (styleConfig) {
  if (styleConfig.type === 'uniform') {
    return fillFor(styleConfig.classes[0])
  }

  // Sources retain the file's band order; OpenLayers handles nodata alpha.
  const band = ['band', styleConfig.band]

  if (styleConfig.type === 'range' && !isClassCodedCog(styleConfig)) {
    /** @type {import('ol/expr/expression.js').EncodedExpression[]} */
    const branches = ['case', ['<', band, styleConfig.minValue], fillFor(styleConfig.default)]
    for (const definition of styleConfig.classes) {
      branches.push(['<=', band, definition.maxValue], fillFor(definition))
    }
    branches.push(fillFor(styleConfig.default))
    return branches
  }

  const definitions = classCodedDefinitions(styleConfig)
  // +1 for the highest bandValue, +1 for a transparent entry for values above it
  const coloursLength = Math.max(...definitions.map(def => def.bandValue)) + 2
  const colours = Array.from({ length: coloursLength }, () => TRANSPARENT)
  for (const definition of definitions) {
    colours[definition.bandValue] = fillFor(definition)
  }

  return ['palette', band, colours]
}

// Fixed field names for style properties avoiding invalid shader identifiers.
// e.g `_mode` generated the invalid identifier `v_prop__mode` (no double underscore allowed).
const STYLE_FILL_PROPERTY = 'styleFill'
const STYLE_STROKE_PROPERTY = 'styleStroke'
const STYLE_STROKE_WIDTH_PROPERTY = 'styleStrokeWidth'

export const VECTOR_STYLE_PROPERTIES = [STYLE_FILL_PROPERTY, STYLE_STROKE_PROPERTY, STYLE_STROKE_WIDTH_PROPERTY]

/**
 * Resolved style values the vector style reads from each feature.
 *
 * @param {object} styleConfig Style config
 * @param {*} value Feature field value
 * @returns {Record<string, *>} Feature properties
 */
export function vectorStyleProperties (styleConfig, value) {
  const definition = definitionForFieldValue(styleConfig, value)
  return {
    [STYLE_FILL_PROPERTY]: fillFor(definition),
    [STYLE_STROKE_PROPERTY]: strokeColourFor(definition),
    [STYLE_STROKE_WIDTH_PROPERTY]: strokeWidthFor(definition)
  }
}

/**
 * Builds an OpenLayers flat style from the class table.
 *
 * @param {object} styleConfig Style config
 * @returns {import('ol/style/flat.js').FlatStyle}
 */
export function buildVectorStyle (styleConfig) {
  if (styleConfig.type === 'range' && styleConfig.field === undefined) {
    throw new Error('A range style config needs a field for vector rendering')
  }

  const style = {
    'fill-color': ['get', STYLE_FILL_PROPERTY]
  }

  if (hasStroke(styleConfig)) {
    style['stroke-color'] = ['get', STYLE_STROKE_PROPERTY]
    style['stroke-width'] = ['get', STYLE_STROKE_WIDTH_PROPERTY]
  }

  return style
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

/**
 * Whether any theme draws a class as an outline with no fill.
 *
 * @param {object[]} themes Style themes
 * @returns {boolean} Whether the dataset has an outline-only class
 */
export function hasOutlineOnlyClass (themes) {
  return themes.some(theme => [...theme.classes, theme.default]
    .some(definition => hasVisibleStroke(definition) && !hasVisibleFill(definition)))
}

export function editableStyleEntries (styleConfig) {
  if (!styleConfig) {
    return []
  }

  return [
    ...styleConfig.classes.map((definition, classIndex) => ({ key: `class:${classIndex}`, classIndex, definition })),
    { key: 'default', definition: styleConfig.default }
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
  if (styleConfig.type === 'uniform') {
    return styleConfig.classes[0]
  }
  if (styleConfig.type === 'range' && !isClassCodedCog(styleConfig)) {
    return rangeClassForValue(styleConfig, value)
  }

  return classCodedDefinitions(styleConfig)
    .find(definition => definition.bandValue === value) ?? null
}

/**
 * Finds the visible class drawn for a theme's COG band. Pixel data can include
 * source nodata alpha or coverage alpha appended by OpenLayers reprojection.
 *
 * @param {object} styleConfig Resolved style theme
 * @param {ArrayLike<number>|null|undefined} bands Pixel band values
 * @param {{ bandCount: number, hasAlpha: boolean }} source GeoTIFF source band layout
 * @returns {object|null} The visible class/default definition
 */
export function visibleClassForBands (styleConfig, bands, source) {
  if (!bands?.length) {
    return null
  }

  const dataBandCount = source.bandCount - (source.hasAlpha ? 1 : 0)
  if (styleConfig.band > dataBandCount) {
    return null
  }

  if (bands.length > dataBandCount && !bands[dataBandCount]) {
    return null
  }

  const value = bands[styleConfig.band - 1]
  if (value === undefined || value === null) {
    return null
  }

  const definition = classForCogValue(styleConfig, value)
  return definition && hasVisibleFill(definition) ? definition : null
}
