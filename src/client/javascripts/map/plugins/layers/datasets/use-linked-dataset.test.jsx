// @vitest-environment jsdom
import { render } from '@testing-library/preact'
import { useLinkedDataset } from './use-linked-dataset.js'

const DATASET_ID = '8d4c1e2a-3b5f-4a6c-9d7e-1f2a3b4c5d6e'

function LinkedDataset ({ datasetId = DATASET_ID, isMapReady = true, dispatch, hints = { show: vi.fn() } }) {
  useLinkedDataset({ datasetId, isMapReady, dispatch, hints })
  return null
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('does nothing without a linked dataset', () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  render(<LinkedDataset datasetId={null} dispatch={vi.fn()} />)

  expect(fetch).not.toHaveBeenCalled()
})

test('adds the linked dataset once the map is ready', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ id: DATASET_ID, title: 'Peat depth', display: {} }) })))
  const dispatch = vi.fn()
  const view = render(<LinkedDataset isMapReady={false} dispatch={dispatch} />)
  expect(fetch).not.toHaveBeenCalled()

  view.rerender(<LinkedDataset dispatch={dispatch} />)

  await vi.waitFor(() => expect(dispatch).toHaveBeenCalledWith({ type: 'DATASET_LOADING', payload: { id: DATASET_ID, title: 'Peat depth' } }))
  expect(fetch).toHaveBeenCalledWith(`/api/datasets/${DATASET_ID}`, expect.anything())
})

test('shows a hint when the linked dataset cannot be loaded', async () => {
  const logError = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))
  const dispatch = vi.fn()
  const hints = { show: vi.fn() }
  render(<LinkedDataset dispatch={dispatch} hints={hints} />)

  await vi.waitFor(() => expect(hints.show).toHaveBeenCalledWith('Dataset could not be added'))
  expect(dispatch).not.toHaveBeenCalled()
  expect(logError).toHaveBeenCalledWith(`Failed to load linked dataset ${DATASET_ID}`, expect.any(Error))
})

test('cancels the request when unmounted', async () => {
  const requests = []
  vi.stubGlobal('fetch', vi.fn((url, options) => new Promise(resolve => requests.push({ options, resolve }))))
  const dispatch = vi.fn()
  const view = render(<LinkedDataset dispatch={dispatch} />)
  await vi.waitFor(() => expect(requests).toHaveLength(1))

  view.unmount()
  expect(requests[0].options.signal.aborted).toBe(true)

  requests[0].resolve({ ok: true, json: async () => ({ title: 'Peat depth', display: {} }) })
  await Promise.resolve()
  expect(dispatch).not.toHaveBeenCalled()
})
