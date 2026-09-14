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

function mergeThemeOverrides (theme, overrides) {
  if (!theme || !overrides) {
    return theme
  }

  return {
    ...theme,
    classes: theme.classes.map((definition, index) => mergeDefinition(definition, overrides.classes?.[index])),
    ...(theme.default && { default: mergeDefinition(theme.default, overrides.default) })
  }
}

/**
 * Resolves the selected theme, falling back to the first configured theme.
 * @param {object} dataset
 * @param {import('../reducer.js').LayerState} [layer]
 */
export function getLayerTheme (dataset, layer) {
  const themes = dataset.source.styleConfig?.themes
  return themes?.find(theme => theme.band === layer?.themeBand) ?? themes?.[0]
}

/**
 * Derives presentation from immutable dataset config and page-local layer state.
 * The original theme and its overrides retain their identity for renderer updates.
 * @param {object} dataset
 * @param {import('../reducer.js').LayerState} [layer]
 */
export function getLayerStyle (dataset, layer) {
  const theme = getLayerTheme(dataset, layer)
  const overrides = layer?.styleOverridesByTheme?.[theme?.band]

  return {
    theme,
    overrides,
    styleConfig: mergeThemeOverrides(theme, overrides),
    opacity: layer?.opacity ?? dataset.source.opacity
  }
}
