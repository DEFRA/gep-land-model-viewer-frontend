const TRANSPARENT = [0, 0, 0, 0]

function isFillArray (fill) {
  return Array.isArray(fill) && fill.length === 4 && fill.every(Number.isFinite)
}

function isRangeConfig (styleConfig) {
  return styleConfig.classes.some((definition) => definition.maxBandValue !== undefined)
}

function isKeyed (definition) {
  return definition.bandValue !== undefined || definition.fieldValue !== undefined
}

function validateClassShape (definition, datasetId) {
  if (typeof definition.label !== 'string' || !isFillArray(definition.fill)) {
    throw new Error(`Dataset ${datasetId} style config classes must each have a label and an [r, g, b, a] fill`)
  }

  if (isKeyed(definition) && definition.maxBandValue !== undefined) {
    throw new Error(`Dataset ${datasetId} style config mixes categorical and range values in one class`)
  }
}

function validateClassKeyTypes (definition, datasetId) {
  if (definition.bandValue !== undefined && !Number.isFinite(definition.bandValue)) {
    throw new Error(`Dataset ${datasetId} style config bandValues must be numbers`)
  }

  if (definition.fieldValue !== undefined && typeof definition.fieldValue !== 'string') {
    throw new Error(`Dataset ${datasetId} style config fieldValues must be strings`)
  }

  if (definition.maxBandValue !== undefined && !Number.isFinite(definition.maxBandValue)) {
    throw new Error(`Dataset ${datasetId} style config maxBandValues must be numbers`)
  }
}

function validateClasses (classes, datasetId) {
  for (const definition of classes) {
    validateClassShape(definition, datasetId)
    validateClassKeyTypes(definition, datasetId)
  }

  const rangeCount = classes.filter((definition) => definition.maxBandValue !== undefined).length
  if (rangeCount > 0) {
    validateRangeClasses(classes, rangeCount, datasetId)
  } else if (classes.some(isKeyed)) {
    validateKeyedClasses(classes, datasetId)
  } else if (classes.length > 1) {
    throw new Error(`Dataset ${datasetId} style config has multiple classes but no bandValue, fieldValue or maxBandValue keys`)
  } else {
    // A single unkeyed class is the fallback style for every feature.
  }
}

function validateKeyedClasses (classes, datasetId) {
  if (!classes.every(isKeyed)) {
    throw new Error(`Dataset ${datasetId} style config mixes keyed and unkeyed classes`)
  }

  validateCategoricalKeys(classes, datasetId)
}

function validateCategoricalKeys (classes, datasetId) {
  const owners = new Map()

  classes.forEach((definition, index) => {
    const keys = []
    if (definition.fieldValue !== undefined) {
      keys.push(definition.fieldValue)
    }
    if (definition.bandValue !== undefined) {
      keys.push(String(definition.bandValue))
    }

    for (const key of keys) {
      const owner = owners.get(key)
      if (owner !== undefined && owner !== index) {
        throw new Error(`Dataset ${datasetId} style config repeats categorical key "${key}" across classes`)
      }
      owners.set(key, index)
    }
  })
}

function validateRangeClasses (classes, rangeCount, datasetId) {
  const openEnded = classes.at(-1).maxBandValue === undefined
  if (rangeCount < classes.length - (openEnded ? 1 : 0)) {
    throw new Error(`Dataset ${datasetId} style config range classes must all carry maxBandValue, except an open-ended last class`)
  }

  const breaks = classes.slice(0, openEnded ? -1 : undefined).map((definition) => definition.maxBandValue)
  if (breaks.some((value, index) => index > 0 && value <= breaks[index - 1])) {
    throw new Error(`Dataset ${datasetId} style config range breaks must ascend`)
  }

  const last = classes.at(-1)
  if (openEnded && (last.bandValue !== undefined || last.fieldValue !== undefined)) {
    throw new Error(`Dataset ${datasetId} style config range classes cannot have bandValues or fieldValues`)
  }
}

/**
 * Validates a dataset style before OpenLayers compiles it, so malformed
 * configuration fails the toggle instead of silently drawing a blank layer.
 *
 * @param {object} styleConfig Style config
 * @param {string} datasetId Dataset id named in error messages
 * @param {object} [options]
 * @param {boolean} [options.requireBandValues=false] Require a categorical COG value for every class
 */
export function validateStyleConfig (styleConfig, datasetId, { requireBandValues = false } = {}) {
  if (!Array.isArray(styleConfig?.classes) || styleConfig.classes.length === 0) {
    throw new Error(`Dataset ${datasetId} style config must define classes`)
  }

  validateClasses(styleConfig.classes, datasetId)

  if (requireBandValues && !styleConfig.classes.every((definition) => definition.bandValue !== undefined)) {
    throw new Error(`Dataset ${datasetId} has a cog overview but not every style class carries a bandValue`)
  }

  validateField(styleConfig, datasetId)
  validateStrokeAndDefault(styleConfig, datasetId)
}

function validateField (styleConfig, datasetId) {
  if (styleConfig.field !== undefined && (typeof styleConfig.field !== 'string' || styleConfig.field.length === 0)) {
    throw new Error(`Dataset ${datasetId} style config field must be a non-empty string`)
  }

  if (styleConfig.classes.some((definition) => definition.fieldValue !== undefined) && styleConfig.field === undefined) {
    throw new Error(`Dataset ${datasetId} style config classes have fieldValues but no field is named`)
  }
}

function validateStrokeAndDefault (styleConfig, datasetId) {
  if (styleConfig.stroke !== undefined && (!isFillArray(styleConfig.stroke.color) || !Number.isFinite(styleConfig.stroke.width))) {
    throw new Error(`Dataset ${datasetId} style config stroke must have an [r, g, b, a] color and a width`)
  }

  if (styleConfig.default !== undefined && !isFillArray(styleConfig.default.fill)) {
    throw new Error(`Dataset ${datasetId} style config default must have an [r, g, b, a] fill`)
  }
}

/**
 * Builds a WebGL tile colour expression from categorical values or range
 * breaks.
 *
 * Categorical values are matched exactly. Their COG overviews must use mode or
 * nearest resampling, otherwise pyramid pixels may not match any class.
 *
 * @param {object} styleConfig Style config
 * @returns {import('ol/expr/expression.js').EncodedExpression}
 */
export function cogColorFor (styleConfig) {
  /** @type {import('ol/expr/expression.js').EncodedExpression[]} */
  const branches = ['case']
  // Generated COGs have one data band; OpenLayers handles their nodata alpha.
  const band = ['band', 1]
  if (isRangeConfig(styleConfig)) {
    for (const { maxBandValue, fill } of styleConfig.classes) {
      if (maxBandValue !== undefined) {
        branches.push(['<=', band, maxBandValue], fill)
      }
    }

    const last = styleConfig.classes.at(-1)
    branches.push(last.maxBandValue === undefined ? last.fill : defaultFillFor(styleConfig))
  } else {
    for (const { bandValue, fill } of styleConfig.classes) {
      branches.push(['==', band, bandValue], fill)
    }
    branches.push(defaultFillFor(styleConfig))
  }

  return branches
}

/**
 * Builds an OpenLayers flat style from the class table.
 *
 * Both fieldValue and String(bandValue) are registered so FlatGeobuf detail
 * and numeric-code overview tiles can share the style. OpenLayers requires
 * every key in a match expression to have the same type.
 *
 * @param {object} styleConfig Style config
 * @returns {import('ol/style/flat.js').FlatStyle}
 */
export function vectorStyleFor (styleConfig) {
  const style = {}
  if (styleConfig.stroke !== undefined) {
    style['stroke-color'] = styleConfig.stroke.color
    style['stroke-width'] = styleConfig.stroke.width
  }

  if (styleConfig.field === undefined) {
    style['fill-color'] = styleConfig.classes[0].fill

    return style
  }

  /** @type {import('ol/expr/expression.js').EncodedExpression[]} */
  const branches = ['match', ['get', styleConfig.field]]
  const seen = new Set()
  const addMatch = (key, fill) => {
    if (!seen.has(key)) {
      seen.add(key)
      branches.push(key, fill)
    }
  }

  for (const { bandValue, fieldValue, fill } of styleConfig.classes) {
    if (fieldValue !== undefined) {
      addMatch(fieldValue, fill)
    }

    if (bandValue !== undefined) {
      addMatch(String(bandValue), fill)
    }
  }
  branches.push(defaultFillFor(styleConfig))
  style['fill-color'] = branches

  return style
}

/**
 * Looks up the class definition for a raster band value.
 *
 * @param {object} styleConfig Style config
 * @param {number} value Band value
 * @returns {object|null} The class definition, or null when no class matches
 */
export function classForBandValue (styleConfig, value) {
  if (isRangeConfig(styleConfig)) {
    const matched = styleConfig.classes.find((definition) => definition.maxBandValue !== undefined && value <= definition.maxBandValue)
    if (matched) {
      return matched
    }

    const last = styleConfig.classes.at(-1)

    return last.maxBandValue === undefined ? last : null
  }

  return styleConfig.classes.find((definition) => definition.bandValue === value) ?? null
}

/**
 * Finds the class drawn for a single-band COG pixel. OpenLayers appends a
 * mask band that decides whether the pixel is drawn at all.
 *
 * @param {object} styleConfig Style config
 * @param {ArrayLike<number>|null|undefined} bands Pixel band values
 * @returns {object|null} The class definition, or null when the pixel is not drawn
 */
export function classForBands (styleConfig, bands) {
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

  return classForBandValue(styleConfig, value)
}

function defaultFillFor (styleConfig) {
  return styleConfig.default?.fill ?? TRANSPARENT
}
