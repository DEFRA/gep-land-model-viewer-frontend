import { DEFAULT_OPACITY } from './source.js'

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
 * @param {import('../reducer.js').LayerState} [layer]
 */
export function getLayerTheme (layer) {
  const themes = layer?.source?.styleConfig?.themes
  return themes?.find(theme => theme.band === layer.themeBand) ?? themes?.[0]
}

/**
 * Derives presentation from the layer's source and its user overrides.
 * The original theme and its overrides retain their identity for renderer updates.
 * @param {import('../reducer.js').LayerState} [layer]
 */
export function getLayerStyle (layer) {
  const theme = getLayerTheme(layer)
  const overrides = layer?.styleOverridesByTheme?.[theme?.band]

  return {
    theme,
    overrides,
    styleConfig: mergeThemeOverrides(theme, overrides),
    opacity: layer?.opacity ?? layer?.source?.opacity ?? DEFAULT_OPACITY
  }
}
