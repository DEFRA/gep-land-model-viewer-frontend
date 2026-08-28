import { describe, test, expect } from 'vitest'
import { initialState, actions } from './reducer.js'

const hit = (label = 'Grid square', id = 0) => ({ id, label, panelTitle: label })

describe('layers reducer', () => {
  test('starts with the plugin state at its natural level', () => {
    expect(initialState).toEqual({
      query: '',
      datasets: {},
      summaries: {},
      inspection: { status: 'idle', hits: [], hit: null }
    })
  })

  test('updates the Layers panel search query', () => {
    const state = actions.SET_QUERY(initialState, 'wood')

    expect(state.query).toBe('wood')
    expect(state.datasets).toBe(initialState.datasets)
    expect(state.inspection).toBe(initialState.inspection)
  })

  test('records requested visibility while a dataset loads', () => {
    const state = actions.SET_DATASET_LOADING(initialState, { id: 'peat', visible: true })

    expect(state.datasets.peat).toEqual({ visible: true, loading: true })
  })

  test('records the map state without discarding other dataset fields', () => {
    const loading = actions.SET_DATASET_LOADING({
      ...initialState,
      datasets: { peat: { style: { fill: '#00ff00' } } }
    }, { id: 'peat', visible: true })
    const state = actions.SET_DATASET_STATE(loading, { id: 'peat', visible: true, minZoom: 8 })

    expect(state.datasets.peat).toEqual({
      style: { fill: '#00ff00' },
      visible: true,
      loading: false,
      minZoom: 8
    })
  })

  test('updates one summary without replacing the others', () => {
    const state = actions.SET_SUMMARY(
      { ...initialState, summaries: { grid: true } },
      { id: 'features', visible: false }
    )

    expect(state.summaries).toEqual({ grid: true, features: false })
  })

  test('starts a new inspection and clears the previous result', () => {
    const state = actions.SEARCH_STARTED({
      ...initialState,
      inspection: { ...initialState.inspection, hits: [hit()] }
    })

    expect(state.inspection).toEqual({ ...initialState.inspection, status: 'searching' })
  })

  test('reports an empty inspection', () => {
    expect(actions.SHOW_EMPTY(initialState).inspection.status).toBe('empty')
  })

  test('shows a list or selected hit without depending on a previous dispatch', () => {
    const hits = [hit('Grid square'), hit('OS feature', 1)]
    const list = actions.SHOW_LIST(initialState, { hits })
    const selected = actions.SHOW_HIT(initialState, { hit: hits[0], hits })

    expect(list.inspection).toMatchObject({ status: 'list', hits, hit: null })
    expect(selected.inspection).toMatchObject({ status: 'detail-loading', hits, hit: hits[0] })
  })

  test('loads details immutably into both the selected hit and hit list', () => {
    const selectedHit = hit()
    const selected = actions.SHOW_HIT(initialState, { hit: selectedHit, hits: [selectedHit] })
    const loaded = actions.DETAILS_LOADED(selected, { details: { code: 'SK18' } })

    expect(loaded.inspection.status).toBe('detail-ready')
    expect(loaded.inspection.hit).not.toBe(selectedHit)
    expect(loaded.inspection.hit.details).toEqual({ code: 'SK18' })
    expect(loaded.inspection.hits[0]).toBe(loaded.inspection.hit)
  })

  test('reports a detail failure', () => {
    const selectedHit = hit()
    const selected = actions.SHOW_HIT(initialState, { hit: selectedHit, hits: [selectedHit] })

    expect(actions.DETAILS_FAILED(selected).inspection.status).toBe('detail-error')
  })

  test('updates backing hits without disturbing retained detail state', () => {
    const selectedHit = hit()
    const other = hit('OS feature', 1)
    const selected = actions.SHOW_HIT(initialState, { hit: selectedHit, hits: [selectedHit, other] })
    const state = actions.SET_HITS(selected, { hits: [selectedHit] })

    expect(state.inspection).toMatchObject({ status: 'detail-loading', hit: selectedHit, hits: [selectedHit] })
  })

  test('resets inspection without replacing layer state', () => {
    const datasets = { peat: { visible: true } }
    const state = actions.RESET_INSPECTION({
      ...initialState,
      datasets,
      inspection: { status: 'list', hits: [hit()], hit: null }
    })

    expect(state.inspection).toBe(initialState.inspection)
    expect(state.datasets).toBe(datasets)
  })
})
