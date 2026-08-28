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
 * @typedef {object} DatasetState
 * @property {boolean} [visible]
 * @property {boolean} [loading]
 * @property {number} [minZoom]
 * @property {Record<string, unknown>} [style]
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
 * @property {Record<string, DatasetState>} datasets
 * @property {Record<string, boolean>} summaries
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
  datasets: {},
  summaries: {},
  inspection: initialInspectionState
}

const setQuery = (state, query) => ({
  ...state,
  query
})

const setDatasetLoading = (state, { id, visible }) => ({
  ...state,
  datasets: {
    ...state.datasets,
    [id]: { ...state.datasets[id], visible, loading: true }
  }
})

const setDatasetState = (state, { id, visible, minZoom }) => ({
  ...state,
  datasets: {
    ...state.datasets,
    [id]: { ...state.datasets[id], visible, minZoom, loading: false }
  }
})

const setSummary = (state, { id, visible }) => ({
  ...state,
  summaries: {
    ...state.summaries,
    [id]: visible
  }
})

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

const showHit = (state, { hit, hits }) => ({
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

const actions = {
  SET_QUERY: setQuery,
  SET_DATASET_LOADING: setDatasetLoading,
  SET_DATASET_STATE: setDatasetState,
  SET_SUMMARY: setSummary,
  SEARCH_STARTED: searchStarted,
  SHOW_EMPTY: showEmpty,
  SHOW_LIST: showList,
  SHOW_HIT: showHit,
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
