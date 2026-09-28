import { useEffect } from 'react'
import { loadCatalogue } from './api.js'

const SEARCH_DEBOUNCE_MS = 200

/** @param {{ catalogue: import('../reducer.js').CatalogueState, dispatch: (action: object) => void }} props */
export function useCatalogue ({ catalogue, dispatch }) {
  const query = catalogue.query.trim()

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      const request = { query }

      try {
        const result = await loadCatalogue(query, controller.signal)
        if (!controller.signal.aborted) {
          dispatch({ type: 'CATALOGUE_LOADED', payload: { ...result, query } })
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Failed to load dataset catalogue', error)
          dispatch({ type: 'CATALOGUE_FAILED', payload: request })
        }
      }
    }, query ? SEARCH_DEBOUNCE_MS : 0)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, catalogue.attempt])
}
