import { useEffect, useRef } from 'react'
import { createGridSummary } from './summaries/grid/index.jsx'
import { featureHitOptions } from './summaries/feature/index.jsx'
import { createLayerHits } from './data-layers/hits.jsx'
import { createInspection } from './inspection/index.js'
import { getAttribution } from './data-layers/attribution.js'
import { createLayerController } from './layer-controller.js'
import { inspectableLayers } from './reducer.js'
import { useCatalogue } from './datasets/use-catalogue.js'
import { useLinkedDataset } from './datasets/use-linked-dataset.js'
import { loadLayer } from './data-layers/api.js'
import { loadGridLayer } from './summaries/grid/api.js'
import { loadFeatureLayer } from './summaries/feature/api.js'
import { FEATURE_SUMMARY, GRID_SUMMARY } from './summaries/config.js'

const ATTRIBUTIONS_SELECTOR = '.im-c-attributions'

const LAYER_LOADERS = {
  [GRID_SUMMARY.id]: loadGridLayer,
  [FEATURE_SUMMARY.id]: loadFeatureLayer
}

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
    const grid = createGridSummary(services.eventBus, map, () => layersRef.current)
    // The grid identifies its own cells.
    const layerHits = createLayerHits(map, () => layersRef.current.filter(layer => layer.id !== GRID_SUMMARY.id), {
      [FEATURE_SUMMARY.id]: featureHitOptions
    })
    const inspection = createInspection({
      map,
      eventBus: services.eventBus,
      sources: [layerHits, grid],
      getInspectionState: () => inspectionStateRef.current,
      dispatch: pluginState.dispatch,
      appDispatch: appState.dispatch,
      announce: services.announce
    })
    const layerController = createLayerController({
      map,
      drawnLayers: { [GRID_SUMMARY.id]: grid },
      loadLayer: (id, url, signal) => (LAYER_LOADERS[id] ?? loadLayer)(id, url, signal),
      onLayerLoaded: (id, metadata) => pluginState.dispatch({
        type: 'LAYER_LOADED',
        payload: { id, ...metadata }
      }),
      onLayerFailed: (id) => {
        const title = layersRef.current.find(layer => layer.id === id)?.title
        pluginState.dispatch({ type: 'LAYER_FAILED', payload: { id } })
        services.hints.show(`${title} could not be added`)
      }
    })

    layerControllerRef.current = layerController
    inspectionRef.current = inspection

    return () => {
      layerController.dispose()
      inspection.dispose()
      layerHits.dispose()
      grid.dispose()
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
