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

/**
 * @typedef {object} LayersState
 * @property {string} query
 * @property {string[]} expandedDatasetThemes
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
  query: '',
  expandedDatasetThemes: [],
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

const setQuery = (state, query) => ({
  ...state,
  query
})

const setDatasetThemeExpanded = (state, { datasetTheme, expanded }) => {
  if (state.expandedDatasetThemes.includes(datasetTheme) === expanded) {
    return state
  }

  return {
    ...state,
    expandedDatasetThemes: expanded
      ? [...state.expandedDatasetThemes, datasetTheme]
      : state.expandedDatasetThemes.filter(candidate => candidate !== datasetTheme)
  }
}

const setEditingLayer = (state, editingLayer) => state.editingLayer === editingLayer ? state : { ...state, editingLayer }

const datasetLoading = (state, { id }) => {
  if (state.layers.some(layer => layer.id === id)) {
    return state
  }

  return {
    ...state,
    layers: [{ id, ready: false }, ...state.layers]
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

export function isLayerVisible (state, id) {
  const layer = state.layers.find(candidate => candidate.id === id)
  return isLayerStateVisible(layer)
}

export function inspectableLayers (datasets, state) {
  return [
    ...SUMMARIES
      .filter(summary => isLayerVisible(state, summary.id))
      .map(summary => ({ id: summary.id })),
    ...datasets
      .filter(dataset => isLayerVisible(state, dataset.id))
      .map(dataset => ({
        id: dataset.id,
        themeBand: getLayerTheme(dataset, state.layers.find(layer => layer.id === dataset.id))?.band
      }))
  ].sort((a, b) => a.id.localeCompare(b.id))
}

const actions = {
  SET_QUERY: setQuery,
  SET_DATASET_THEME_EXPANDED: setDatasetThemeExpanded,
  SET_EDITING_LAYER: setEditingLayer,
  DATASET_LOADING: datasetLoading,
  DATASET_LOADED: datasetLoaded,
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
