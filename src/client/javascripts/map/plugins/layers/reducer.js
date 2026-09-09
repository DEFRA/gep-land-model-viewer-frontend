import { SUMMARIES } from './summaries/config.js'

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

/**
 * State for one added dataset or summary layer.
 *
 * @typedef {object} LayerState
 * @property {string} id
 * @property {boolean} ready
 * @property {number} [minZoom]
 * @property {string[]} [wmsLayerNames]
 * @property {boolean} [hidden]
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
 * @property {LayerState[]} layers Top-most entry first
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
  layers: [],
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
    layers
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

export function inspectableLayerIds (datasets, state) {
  return [
    ...SUMMARIES
      .filter(summary => isLayerVisible(state, summary.id))
      .map(summary => summary.id),
    ...datasets
      .filter(dataset => isLayerVisible(state, dataset.id))
      .map(dataset => dataset.id)
  ].sort((a, b) => a.localeCompare(b))
}

const actions = {
  SET_QUERY: setQuery,
  DATASET_LOADING: datasetLoading,
  DATASET_LOADED: datasetLoaded,
  REMOVE_LAYER: removeLayer,
  SET_SUMMARY: setSummary,
  SET_LAYER_HIDDEN: setLayerHidden,
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
