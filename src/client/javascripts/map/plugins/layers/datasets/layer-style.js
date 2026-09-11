export function coloursEqual (a, b) {
  return a === b || (a?.length === b?.length && a?.every((value, index) => value === b[index]))
}

export function colourForDefinition (definition, part) {
  return part === 'fill' ? definition?.fill : definition?.stroke?.color
}

function mergeDefinition (definition, overrides) {
  if (!overrides) {
    return definition
  }

  return {
    ...definition,
    ...overrides,
    ...(overrides.stroke && { stroke: { ...definition.stroke, ...overrides.stroke } })
  }
}

/**
 * Combines dataset defaults with the layer's colour and opacity overrides.
 * @param {object} dataset
 * @param {import('../reducer.js').LayerState} [layer]
 */
export function getLayerStyle (dataset, layer) {
  const defaults = dataset.source.styleConfig
  const overrides = layer?.styleOverrides
  let styleConfig = defaults
  if (defaults && overrides) {
    styleConfig = {
      ...defaults,
      classes: defaults.classes.map((definition, index) => mergeDefinition(definition, overrides.classes?.[index])),
      ...(defaults.default && { default: mergeDefinition(defaults.default, overrides.default) })
    }
  }

  return { opacity: layer?.opacity ?? dataset.source.opacity, styleConfig }
}
