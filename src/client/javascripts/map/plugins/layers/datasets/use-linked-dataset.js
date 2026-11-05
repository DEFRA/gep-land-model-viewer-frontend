import { useEffect } from 'react'
import { loadDatasetMetadata } from './api.js'
import { SUMMARIES } from '../summaries/config.js'

/**
 * @param {{
 *   datasetId?: string | null
 *   isMapReady: boolean
 *   dispatch: (action: object) => void
 *   hints: { show: (html: string) => void }
 * }} props
 */
export function useLinkedDataset ({ datasetId, isMapReady, dispatch, hints }) {
  useEffect(() => {
    if (!datasetId || !isMapReady) {
      return undefined
    }

    const controller = new AbortController()

    async function load () {
      try {
        const { title, catalogueCategories } = await loadDatasetMetadata(datasetId, controller.signal)
        if (!controller.signal.aborted) {
          const summary = SUMMARIES.find(({ catalogueCategory }) => catalogueCategories?.includes(catalogueCategory))
          dispatch(summary
            ? { type: 'SET_SUMMARY', payload: { id: summary.id, enabled: true } }
            : { type: 'DATASET_LOADING', payload: { id: datasetId, title } })
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(`Failed to load linked dataset ${datasetId}`, error)
          hints.show('Dataset could not be added')
        }
      }
    }

    load()

    return () => controller.abort()
  }, [datasetId, isMapReady])
}
