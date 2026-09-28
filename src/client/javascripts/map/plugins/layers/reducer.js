import { SUMMARIES } from './summaries/config.js'
import { colourForDefinition, coloursEqual, getLayerTheme } from './datasets/layer-style.js'

const INSPECTION_STATUS = /** @type {const} */ ({
  IDLE: 'idle',
  SEARCHING: 'searching',
  EMPTY: 'empty',
  LIST: 'list',
  DETAIL_LOADING: 'detail-loading',
  DETAIL_READY: 'detail-ready',
  DETAIL_ERROR: 'detail-error'
})

/** @typedef {typeof INSPECTION_STATUS[keyof typeof INSPECTION_STATUS]} InspectionStatus */

/** @typedef {import('../../config/colours.js').RgbaColour} RgbaColour */
/** @typedef {{ fill?: RgbaColour, stroke?: { color: RgbaColour } }} DefinitionOverride */
/** @typedef {{ classes?: (DefinitionOverride | undefined)[], default?: DefinitionOverride }} StyleOverrides */

/**
 * State for one added dataset or summary layer.
 *
 * @typedef {object} LayerState
 * @property {string} id
 * @property {boolean} ready
 * @property {string} [title] Dataset title, copied from its catalogue result
 * @property {import('./datasets/source.js').DatasetSource} [source] Dataset map source, set once loaded
 * @property {number} [minZoom]
 * @property {string[]} [wmsLayerNames]
 * @property {boolean} [hidden]
 * @property {number} [opacity]
 * @property {number} [themeBand]
 * @property {Record<number, StyleOverrides>} [styleOverridesByTheme]
 */

/**
 * @typedef {object} InspectionState
 * @property {InspectionStatus} status
 * @property {import('./inspection/index.js').Hit[]} hits
 * @property {import('./inspection/index.js').Hit | null} hit
 */

/** @typedef {import('./datasets/api.js').DatasetSummary & { error?: string }} CatalogueResult */

/**
 * @typedef {object} CatalogueState
 * @property {string} query
 * @property {string[]} expandedThemes
 * @property {CatalogueResult[]} results
 * @property {number} total
 * @property {number} attempt
 * @property {'loading' | 'ready' | 'error'} status
 */

/**
 * @typedef {object} LayersState
 * @property {CatalogueState} catalogue
 * @property {LayerState[]} layers Top-most entry first
 * @property {{ id: string, colourKey?: string } | null} editingLayer
 * @property {InspectionState} inspection
 */

/** @type {InspectionState} */
const initialInspectionState = {
  status: INSPECTION_STATUS.IDLE,
  hits: [],
  hit: null
}

/** @type {LayersState} */
const initialState = {
  catalogue: { query: '', expandedThemes: [], results: [], total: 0, attempt: 0, status: 'loading' },
  layers: [],
  editingLayer: null,
  inspection: initialInspectionState
}

function updateLayer (state, id, getUpdatedLayer) {
  const index = state.layers.findIndex(layer => layer.id === id)
  if (index < 0) {
    return state
  }

  const currentLayer = state.layers[index]
  const updatedLayer = getUpdatedLayer(currentLayer)
  if (updatedLayer === currentLayer) {
    return state
  }

  const layers = [...state.layers]
  layers[index] = updatedLayer

  return {
    ...state,
    layers
  }
}

function setQuery (state, query) {
  if (isCurrentSearch(state, { query })) {
    return { ...state, catalogue: { ...state.catalogue, query } }
  }

  return { ...state, catalogue: { ...state.catalogue, query, results: [], total: 0, status: 'loading' } }
}

function isCurrentSearch (state, { query }) {
  return state.catalogue.query.trim() === query.trim()
}

function catalogueFailed (state, request) {
  return isCurrentSearch(state, request) ? { ...state, catalogue: { ...state.catalogue, status: 'error' } } : state
}

const catalogueLoaded = (state, { results, total, query }) => {
  if (!isCurrentSearch(state, { query })) {
    return state
  }

  return { ...state, catalogue: { ...state.catalogue, results, total, status: 'ready' } }
}

const setDatasetThemeExpanded = (state, { datasetTheme, expanded }) => {
  const { expandedThemes } = state.catalogue
  if (expandedThemes.includes(datasetTheme) === expanded) {
    return state
  }

  return {
    ...state,
    catalogue: {
      ...state.catalogue,
      expandedThemes: expanded
        ? [...expandedThemes, datasetTheme]
        : expandedThemes.filter(candidate => candidate !== datasetTheme)
    }
  }
}

function setResultError (state, id, error) {
  if (!state.catalogue.results.some(result => result.id === id && result.error !== error)) {
    return state
  }

  const results = state.catalogue.results.map(result => {
    if (result.id !== id || result.error === error) {
      return result
    }

    const rest = { ...result }
    delete rest.error
    return error ? { ...rest, error } : rest
  })

  return { ...state, catalogue: { ...state.catalogue, results } }
}

const setEditingLayer = (state, editingLayer) => state.editingLayer === editingLayer ? state : { ...state, editingLayer }

const datasetLoading = (state, { id, title }) => {
  if (state.layers.some(layer => layer.id === id)) {
    return state
  }

  return {
    ...setResultError(state, id, undefined),
    layers: [{ id, title, ready: false }, ...state.layers]
  }
}

const datasetLoaded = (state, { id, ...metadata }) => updateLayer(state, id, (layer) => {
  if (layer.ready) {
    return layer
  }

  return {
    ...layer,
    ...metadata,
    ready: true
  }
})

const removeLayer = (state, { id }) => {
  const layers = state.layers.filter(layer => layer.id !== id)
  if (layers.length === state.layers.length) {
    return state
  }

  return {
    ...state,
    layers,
    editingLayer: state.editingLayer?.id === id ? null : state.editingLayer
  }
}

const datasetFailed = (state, { id, error }) => setResultError(removeLayer(state, { id }), id, error)

const setSummary = (state, { id, enabled }) => {
  if (!enabled) {
    return removeLayer(state, { id })
  }

  const otherSummaryIds = new Set(SUMMARIES
    .filter(summary => summary.id !== id)
    .map(summary => summary.id))
  const layers = state.layers.filter(layer => !otherSummaryIds.has(layer.id))

  if (layers.some(layer => layer.id === id)) {
    return layers.length === state.layers.length ? state : { ...state, layers }
  }

  return {
    ...state,
    layers: [{ id, ready: true }, ...layers]
  }
}

const setLayerHidden = (state, { id, hidden }) => updateLayer(state, id, (layer) => {
  if (Boolean(layer.hidden) === hidden) {
    return layer
  }

  if (hidden) {
    return { ...layer, hidden: true }
  }

  const updatedLayer = { ...layer }
  delete updatedLayer.hidden
  return updatedLayer
})

// An undefined value removes an override when the editor restores a dataset default.
const setLayerOpacity = (state, { id, opacity }) => updateLayer(state, id, (layer) => {
  if (layer.opacity === opacity) {
    return layer
  }

  const updated = { ...layer, opacity }
  if (opacity === undefined) {
    delete updated.opacity
  }
  return updated
})

function updateDefinitionColour (previous, part, colour) {
  const definition = { ...previous }
  if (colour === undefined) {
    delete definition[part]
  } else {
    definition[part] = part === 'stroke' ? { color: [...colour] } : [...colour]
  }

  return Object.keys(definition).length ? definition : undefined
}

function withThemeOverrides (layer, themeBand, overrides) {
  const styleOverridesByTheme = { ...layer.styleOverridesByTheme }
  if (overrides && Object.keys(overrides).length) {
    styleOverridesByTheme[themeBand] = overrides
  } else {
    delete styleOverridesByTheme[themeBand]
  }

  const updated = { ...layer }
  if (Object.keys(styleOverridesByTheme).length) {
    updated.styleOverridesByTheme = styleOverridesByTheme
  } else {
    delete updated.styleOverridesByTheme
  }
  return updated
}

const setLayerTheme = (state, { id, themeBand }) => {
  const updated = updateLayer(state, id, layer => layer.themeBand === themeBand ? layer : { ...layer, themeBand })
  if (updated === state || state.editingLayer?.id !== id) {
    return updated
  }

  return { ...updated, editingLayer: { id } }
}

const setLayerColour = (state, { id, themeBand, classIndex, part, colour }) => updateLayer(state, id, (layer) => {
  const overrides = layer.styleOverridesByTheme?.[themeBand]
  const previous = classIndex === undefined
    ? overrides?.default
    : overrides?.classes?.[classIndex]
  if (coloursEqual(colourForDefinition(previous, part), colour)) {
    return layer
  }

  const remaining = updateDefinitionColour(previous, part, colour)
  const styleOverrides = { ...overrides }
  if (classIndex === undefined) {
    if (remaining) {
      styleOverrides.default = remaining
    } else {
      delete styleOverrides.default
    }
  } else {
    const classes = [...styleOverrides.classes ?? []]
    classes[classIndex] = remaining
    if (classes.some(Boolean)) {
      styleOverrides.classes = classes
    } else {
      delete styleOverrides.classes
    }
  }

  return withThemeOverrides(layer, themeBand, styleOverrides)
})

const resetLayerStyle = (state, { id, themeBand }) => updateLayer(state, id, (layer) => {
  if (layer.opacity === undefined && !layer.styleOverridesByTheme?.[themeBand]) {
    return layer
  }

  const updated = withThemeOverrides(layer, themeBand, undefined)
  delete updated.opacity
  return updated
})

export function layerIndexAfterMove (index, length, position) {
  switch (position) {
    case 'top': return 0
    case 'up': return Math.max(0, index - 1)
    case 'down': return Math.min(length - 1, index + 1)
    case 'bottom': return length - 1
    default: return index
  }
}

const moveLayer = (state, { id, position }) => {
  const index = state.layers.findIndex(candidate => candidate.id === id)
  if (index < 0) {
    return state
  }

  const targetIndex = layerIndexAfterMove(index, state.layers.length, position)
  if (targetIndex === index) {
    return state
  }

  const layers = [...state.layers]
  const [layer] = layers.splice(index, 1)
  layers.splice(targetIndex, 0, layer)

  return { ...state, layers }
}

function isValidLayerOrder (currentOrder, candidateOrder) {
  if (!Array.isArray(candidateOrder) || currentOrder.length !== candidateOrder.length) {
    return false
  }

  const candidateIds = new Set(candidateOrder)
  return candidateIds.size === candidateOrder.length && currentOrder.every(id => candidateIds.has(id))
}

const setLayerOrder = (state, { order }) => {
  const currentOrder = state.layers.map(layer => layer.id)
  if (!isValidLayerOrder(currentOrder, order)) {
    return state
  }

  if (currentOrder.every((id, index) => id === order[index])) {
    return state
  }

  const layersById = new Map(state.layers.map(layer => [layer.id, layer]))
  return { ...state, layers: order.map(id => layersById.get(id)) }
}

const searchStarted = state => ({
  ...state,
  inspection: {
    ...initialInspectionState,
    status: INSPECTION_STATUS.SEARCHING
  }
})

const showEmpty = state => ({
  ...state,
  inspection: {
    ...initialInspectionState,
    status: INSPECTION_STATUS.EMPTY
  }
})

const showList = (state, { hits }) => ({
  ...state,
  inspection: {
    ...state.inspection,
    status: INSPECTION_STATUS.LIST,
    hits,
    hit: null
  }
})

const selectHit = (state, { hit, hits }) => ({
  ...state,
  inspection: {
    ...state.inspection,
    status: INSPECTION_STATUS.DETAIL_LOADING,
    hits,
    hit
  }
})

const detailsLoaded = (state, { details }) => {
  const { inspection } = state
  const hit = { ...inspection.hit, details }

  return {
    ...state,
    inspection: {
      ...inspection,
      status: INSPECTION_STATUS.DETAIL_READY,
      hit,
      hits: inspection.hits.map(candidate => candidate === inspection.hit ? hit : candidate)
    }
  }
}

const detailsFailed = state => ({
  ...state,
  inspection: {
    ...state.inspection,
    status: INSPECTION_STATUS.DETAIL_ERROR
  }
})

const setHits = (state, { hits }) => ({
  ...state,
  inspection: {
    ...state.inspection,
    hits
  }
})

const resetInspection = state => ({
  ...state,
  inspection: initialInspectionState
})

export function isLayerStateVisible (layerState) {
  return Boolean(layerState?.ready && !layerState.hidden)
}

export function inspectableLayers (state) {
  return state.layers
    .filter(isLayerStateVisible)
    .map(layer => layer.source ? { id: layer.id, themeBand: getLayerTheme(layer)?.band } : { id: layer.id })
    .sort((a, b) => a.id.localeCompare(b.id))
}

const actions = {
  SET_QUERY: setQuery,
  CATALOGUE_LOADED: catalogueLoaded,
  CATALOGUE_FAILED: catalogueFailed,
  RETRY_CATALOGUE: state => ({ ...state, catalogue: { ...state.catalogue, attempt: state.catalogue.attempt + 1, status: 'loading' } }),
  SET_DATASET_THEME_EXPANDED: setDatasetThemeExpanded,
  SET_EDITING_LAYER: setEditingLayer,
  DATASET_LOADING: datasetLoading,
  DATASET_LOADED: datasetLoaded,
  DATASET_FAILED: datasetFailed,
  REMOVE_LAYER: removeLayer,
  SET_SUMMARY: setSummary,
  SET_LAYER_HIDDEN: setLayerHidden,
  SET_LAYER_THEME: setLayerTheme,
  SET_LAYER_COLOUR: setLayerColour,
  SET_LAYER_OPACITY: setLayerOpacity,
  RESET_LAYER_STYLE: resetLayerStyle,
  MOVE_LAYER: moveLayer,
  SET_LAYER_ORDER: setLayerOrder,
  SEARCH_STARTED: searchStarted,
  SHOW_EMPTY: showEmpty,
  SHOW_LIST: showList,
  SELECT_HIT: selectHit,
  DETAILS_LOADED: detailsLoaded,
  DETAILS_FAILED: detailsFailed,
  SET_HITS: setHits,
  RESET_INSPECTION: resetInspection
}

export {
  initialState,
  actions,
  INSPECTION_STATUS
}
