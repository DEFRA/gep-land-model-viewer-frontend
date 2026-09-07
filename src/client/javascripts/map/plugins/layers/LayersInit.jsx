import { useEffect, useRef } from 'react'
import { EVENTS } from '@defra/interactive-map'
import { createGridSummary } from './summaries/grid/index.jsx'
import { createFeatureSummary } from './summaries/feature/index.jsx'
import { createDatasetHits } from './datasets/hits.jsx'
import { createInspection } from './inspection/index.js'
import { getAttribution } from './datasets/attribution.js'
import { createLayerController } from './layer-controller.js'
import { inspectableLayerIds } from './reducer.js'

const ATTRIBUTIONS_SELECTOR = '.im-c-attributions'

export function LayersInit ({ mapState, mapProvider, pluginConfig, pluginState, appState, services }) {
  const { datasets } = pluginConfig
  const layerControllerRef = useRef(null)
  const inspectionStateRef = useRef(pluginState.inspection)
  inspectionStateRef.current = pluginState.inspection

  const inspectionRef = pluginState.useRef('inspection')
  const inspectableLayerIdsKey = JSON.stringify(inspectableLayerIds(datasets, pluginState))
  const attribution = getAttribution(datasets, pluginState, mapState.mapStyle?.attribution)

  useEffect(() => {
    if (!mapState.isMapReady) {
      return undefined
    }

    const { map } = mapProvider
    const grid = createGridSummary(services.eventBus, map)
    const features = createFeatureSummary(map)
    const summaries = { grid, features }
    const datasetHits = createDatasetHits(map, datasets)
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
      datasets,
      summaries,
      onDatasetLoaded: (id, metadata) => pluginState.dispatch({
        type: 'DATASET_LOADED',
        payload: { id, ...metadata }
      }),
      onDatasetFailed: id => pluginState.dispatch({
        type: 'REMOVE_LAYER',
        payload: { id }
      })
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
  }, [mapState.isMapReady, inspectableLayerIdsKey])

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
