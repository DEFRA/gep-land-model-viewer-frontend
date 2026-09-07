import { describe, test, expect } from 'vitest'
import {
  initialState,
  actions,
  inspectableLayerIds,
  isLayerVisible
} from './reducer.js'

const hit = (label = 'Grid square', id = 0) => ({ id, label, panelTitle: label })
const layer = id => ({ id, ready: true })
const layerIds = state => state.layers.map(({ id }) => id)

describe('layers reducer', () => {
  test('starts with no layers or inspection result', () => {
    expect(initialState).toEqual({
      query: '',
      layers: [],
      inspection: { status: 'idle', hits: [], hit: null }
    })
  })

  test('updates the Layers panel search query', () => {
    const state = actions.SET_QUERY(initialState, 'wood')

    expect(state.query).toBe('wood')
    expect(state.layers).toBe(initialState.layers)
    expect(state.inspection).toBe(initialState.inspection)
  })

  test('adds a dataset to the order while it loads', () => {
    const state = actions.DATASET_LOADING(initialState, { id: 'peat' })

    expect(state.layers).toEqual([{ id: 'peat', ready: false }])
  })

  test('adding an existing dataset is an identity operation', () => {
    const initial = {
      ...initialState,
      layers: [layer('woodland'), layer('peat')]
    }
    const state = actions.DATASET_LOADING(initial, { id: 'peat' })

    expect(state).toBe(initial)
  })

  test('commits metadata returned by a successful load', () => {
    const loading = actions.DATASET_LOADING(initialState, { id: 'peat' })
    const state = actions.DATASET_LOADED(loading, {
      id: 'peat',
      minZoom: 8,
      wmsLayerNames: ['resolved-layer']
    })

    expect(state.layers[0]).toEqual({
      id: 'peat',
      ready: true,
      minZoom: 8,
      wmsLayerNames: ['resolved-layer']
    })
    expect(actions.DATASET_LOADED(state, { id: 'peat', minZoom: 9 })).toBe(state)
  })

  test('adds and removes summaries from the shared order', () => {
    const added = actions.SET_SUMMARY(initialState, { id: 'grid', enabled: true })
    const removed = actions.SET_SUMMARY({
      ...added,
      layers: [{ ...added.layers[0], hidden: true }]
    }, { id: 'grid', enabled: false })

    expect(added.layers).toEqual([{ id: 'grid', ready: true }])
    expect(removed.layers).toEqual([])
  })

  test('enabling a summary replaces the previous summary', () => {
    const state = actions.SET_SUMMARY({
      ...initialState,
      layers: [{ ...layer('grid'), hidden: true }, layer('peat')]
    }, { id: 'features', enabled: true })

    expect(state.layers).toEqual([layer('features'), layer('peat')])
  })

  test('removal drops load state, order and settings', () => {
    const loading = actions.DATASET_LOADING(initialState, { id: 'peat' })
    const removed = actions.REMOVE_LAYER({
      ...loading,
      layers: [{ ...loading.layers[0], hidden: true, opacity: 0.5 }]
    }, { id: 'peat' })

    expect(removed.layers).toEqual([])
    expect(actions.DATASET_LOADED(removed, { id: 'peat', minZoom: 8 })).toBe(removed)
  })

  test('hide and show merge settings for an added entry', () => {
    const state = {
      ...initialState,
      layers: [{ ...layer('peat'), opacity: 0.5 }]
    }
    const hidden = actions.SET_LAYER_HIDDEN(state, { id: 'peat', hidden: true })
    const shown = actions.SET_LAYER_HIDDEN(hidden, { id: 'peat', hidden: false })

    expect(hidden.layers[0]).toEqual({ id: 'peat', ready: true, opacity: 0.5, hidden: true })
    expect(shown.layers[0]).toEqual({ id: 'peat', ready: true, opacity: 0.5 })
    expect(actions.SET_LAYER_HIDDEN(shown, { id: 'missing', hidden: true })).toBe(shown)
  })

  test.each([
    ['top', 'third', ['third', 'first', 'second']],
    ['up', 'third', ['first', 'third', 'second']],
    ['down', 'second', ['first', 'third', 'second']],
    ['bottom', 'first', ['second', 'third', 'first']]
  ])('moves an entry %s', (position, id, expected) => {
    const state = { ...initialState, layers: ['first', 'second', 'third'].map(layer) }

    expect(layerIds(actions.MOVE_LAYER(state, { id, position }))).toEqual(expected)
  })

  test('boundary and unknown moves are identity operations', () => {
    const state = { ...initialState, layers: ['first', 'second'].map(layer) }

    expect(actions.MOVE_LAYER(state, { id: 'first', position: 'up' })).toBe(state)
    expect(actions.MOVE_LAYER(state, { id: 'second', position: 'down' })).toBe(state)
    expect(actions.MOVE_LAYER(state, { id: 'missing', position: 'top' })).toBe(state)
  })

  test('accepts only an exact reordered permutation', () => {
    const state = { ...initialState, layers: ['first', 'second', 'third'].map(layer) }
    const reordered = actions.SET_LAYER_ORDER(state, { order: ['third', 'first', 'second'] })

    expect(layerIds(reordered)).toEqual(['third', 'first', 'second'])
    expect(reordered.layers[1]).toBe(state.layers[0])
    expect(actions.SET_LAYER_ORDER(state, { order: ['first', 'third'] })).toBe(state)
    expect(actions.SET_LAYER_ORDER(state, { order: ['first', 'first', 'third'] })).toBe(state)
    expect(actions.SET_LAYER_ORDER(state, { order: ['first', 'second', 'other'] })).toBe(state)
    expect(actions.SET_LAYER_ORDER(state, { order: ['first', 'second', 'third'] })).toBe(state)
  })

  test('derives visible and inspectable layers from reducer state', () => {
    const state = {
      ...initialState,
      layers: [
        layer('grid'),
        layer('ready'),
        { ...layer('hidden'), hidden: true },
        { id: 'loading', ready: false }
      ]
    }

    expect(isLayerVisible(state, 'ready')).toBe(true)
    expect(isLayerVisible(state, 'hidden')).toBe(false)
    expect(isLayerVisible(state, 'loading')).toBe(false)
    expect(inspectableLayerIds([
      { id: 'ready' },
      { id: 'hidden' },
      { id: 'loading' }
    ], state)).toEqual(['grid', 'ready'])
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
    const selected = actions.SELECT_HIT(initialState, { hit: hits[0], hits })

    expect(list.inspection).toMatchObject({ status: 'list', hits, hit: null })
    expect(selected.inspection).toMatchObject({ status: 'detail-loading', hits, hit: hits[0] })
  })

  test('loads details immutably into both the selected hit and hit list', () => {
    const selectedHit = hit()
    const selected = actions.SELECT_HIT(initialState, { hit: selectedHit, hits: [selectedHit] })
    const loaded = actions.DETAILS_LOADED(selected, { details: { code: 'SK18' } })

    expect(loaded.inspection.status).toBe('detail-ready')
    expect(loaded.inspection.hit).not.toBe(selectedHit)
    expect(loaded.inspection.hit.details).toEqual({ code: 'SK18' })
    expect(loaded.inspection.hits[0]).toBe(loaded.inspection.hit)
  })

  test('reports a detail failure', () => {
    const selectedHit = hit()
    const selected = actions.SELECT_HIT(initialState, { hit: selectedHit, hits: [selectedHit] })

    expect(actions.DETAILS_FAILED(selected).inspection.status).toBe('detail-error')
  })

  test('updates backing hits without disturbing retained detail state', () => {
    const selectedHit = hit()
    const other = hit('OS feature', 1)
    const selected = actions.SELECT_HIT(initialState, { hit: selectedHit, hits: [selectedHit, other] })
    const state = actions.SET_HITS(selected, { hits: [selectedHit] })

    expect(state.inspection).toMatchObject({ status: 'detail-loading', hit: selectedHit, hits: [selectedHit] })
  })

  test('resets inspection without replacing layer state', () => {
    const layers = [{ ...layer('peat'), minZoom: 8 }]
    const state = actions.RESET_INSPECTION({
      ...initialState,
      layers,
      inspection: { status: 'list', hits: [hit()], hit: null }
    })

    expect(state.inspection).toBe(initialState.inspection)
    expect(state.layers).toBe(layers)
  })
})
