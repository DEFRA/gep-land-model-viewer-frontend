import { useEffect, useRef } from 'react'
import { EVENTS } from '@defra/interactive-map'
import { createGridSummary } from './summaries/grid/index.jsx'
import { createFeatureSummary } from './summaries/feature/index.jsx'
import { createDatasetHits } from './datasets/hits.jsx'
import { createInspection } from './inspection/index.js'
import { getAttribution } from './datasets/attribution.js'
import { createLayerController } from './layer-controller.js'
import { inspectableLayers } from './reducer.js'
import { useCatalogue } from './datasets/use-catalogue.js'
import { useLinkedDataset } from './datasets/use-linked-dataset.js'
import { loadDataset } from './datasets/api.js'

const ATTRIBUTIONS_SELECTOR = '.im-c-attributions'
const DATASET_FAILED_MESSAGE = 'This dataset could not be added. Try again later.'

export function LayersInit ({ mapState, mapProvider, pluginConfig, pluginState, appState, services }) {
  useCatalogue(pluginState)
  useLinkedDataset({
    datasetId: pluginConfig.datasetId,
    isMapReady: mapState.isMapReady,
    dispatch: pluginState.dispatch,
    hints: services.hints
  })
  const layerControllerRef = useRef(null)
  const layersRef = useRef(pluginState.layers)
  layersRef.current = pluginState.layers
  const inspectionStateRef = useRef(pluginState.inspection)
  inspectionStateRef.current = pluginState.inspection

  const inspectionRef = pluginState.useRef('inspection')
  const inspectableLayersKey = JSON.stringify(inspectableLayers(pluginState))
  const attribution = getAttribution(pluginState, mapState.mapStyle?.attribution)

  useEffect(() => {
    if (!mapState.isMapReady) {
      return undefined
    }

    const { map } = mapProvider
    const grid = createGridSummary(services.eventBus, map)
    const features = createFeatureSummary(map)
    const summaries = { grid, features }
    const datasetHits = createDatasetHits(map, () => layersRef.current)
    const inspection = createInspection({
      map,
      eventBus: services.eventBus,
      sources: [datasetHits, grid, features],
      getInspectionState: () => inspectionStateRef.current,
      dispatch: pluginState.dispatch,
      appDispatch: appState.dispatch,
      announce: services.announce
    })
    const layerController = createLayerController({
      map,
      summaries,
      loadDataset,
      onDatasetLoaded: (id, metadata) => pluginState.dispatch({
        type: 'DATASET_LOADED',
        payload: { id, ...metadata }
      }),
      onDatasetFailed: (id) => {
        const title = layersRef.current.find(layer => layer.id === id)?.title
        pluginState.dispatch({ type: 'DATASET_FAILED', payload: { id, error: DATASET_FAILED_MESSAGE } })
        services.hints.show(`${title} could not be added`)
      }
    })

    layerControllerRef.current = layerController
    inspectionRef.current = inspection

    const syncFeatureSource = ({ mapStyleId }) => features.setMapStyle(mapStyleId)

    syncFeatureSource({ mapStyleId: mapState.mapStyle.id })
    services.eventBus.on(EVENTS.MAP_STYLE_CHANGE, syncFeatureSource)

    return () => {
      services.eventBus.off(EVENTS.MAP_STYLE_CHANGE, syncFeatureSource)
      layerController.dispose()
      inspection.dispose()
      datasetHits.dispose()
      grid.dispose()
      features.dispose()
      layerControllerRef.current = null
      inspectionRef.current = null
    }
  }, [mapState.isMapReady])

  useEffect(() => {
    if (!mapState.isMapReady) {
      return
    }

    layerControllerRef.current?.sync(pluginState.layers)
  }, [
    mapState.isMapReady,
    pluginState.layers
  ])

  useEffect(() => {
    if (!mapState.isMapReady) {
      return
    }

    inspectionRef.current?.reconcile()
  }, [mapState.isMapReady, inspectableLayersKey])

  // interactive-map has no API for adding dataset attributions.
  useEffect(() => {
    if (!mapState.isMapReady) {
      return
    }

    const element = document.querySelector(ATTRIBUTIONS_SELECTOR)
    if (element) {
      element.textContent = attribution
    }
  }, [mapState.isMapReady, attribution])

  return null
}
