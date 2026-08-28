import { useEffect, useRef } from 'react'
import { EVENTS } from '@defra/interactive-map'
import { createGridSummary } from './summaries/grid/index.jsx'
import { createFeatureSummary } from './summaries/feature/index.jsx'
import { createDatasetHits } from './datasets/hits.jsx'
import { createInspection } from './inspection/index.js'
import { INFO_PANEL_ID } from './constants.js'
import { getAttribution } from './datasets/attribution.js'
import { SUMMARY_TOGGLES } from './summaries/options.js'

const ATTRIBUTIONS_SELECTOR = '.im-c-attributions'
const INFO_PANEL_OPEN_CLASS = 'app-map--info-panel-open'

export function LayersInit ({ mapState, mapProvider, pluginConfig, pluginState, appState, services }) {
  const { datasets } = pluginConfig
  const summariesRef = useRef(null)
  const inspectionStateRef = useRef(pluginState.inspection)
  inspectionStateRef.current = pluginState.inspection

  const inspectionRef = pluginState.useRef('inspection')

  useEffect(() => {
    if (!mapState.isMapReady) {
      return undefined
    }

    const { map } = mapProvider
    const grid = createGridSummary(services.eventBus, map)
    const features = createFeatureSummary(map)
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

    summariesRef.current = { grid, features }
    inspectionRef.current = inspection

    const syncFeatureSource = ({ mapStyleId }) => features.setMapStyle(mapStyleId)

    syncFeatureSource({ mapStyleId: mapState.mapStyle.id })
    services.eventBus.on(EVENTS.MAP_STYLE_CHANGE, syncFeatureSource)

    return () => {
      services.eventBus.off(EVENTS.MAP_STYLE_CHANGE, syncFeatureSource)
      inspection.dispose()
      datasetHits.dispose()
      grid.dispose()
      features.dispose()
      summariesRef.current = null
      inspectionRef.current = null
    }
  }, [mapState.isMapReady])

  useEffect(() => {
    if (!mapState.isMapReady || !summariesRef.current) {
      return
    }

    for (const { id } of SUMMARY_TOGGLES) {
      summariesRef.current[id].setVisible(Boolean(pluginState.summaries[id]))
    }
    inspectionRef.current?.reconcile()
  }, [mapState.isMapReady, pluginState.summaries])

  // interactive-map has no API for adding dataset attributions.
  useEffect(() => {
    if (!mapState.isMapReady) {
      return
    }

    const element = document.querySelector(ATTRIBUTIONS_SELECTOR)
    if (element) {
      element.textContent = getAttribution(mapProvider.map, datasets, mapState.mapStyle.attribution)
    }
  }, [mapState.isMapReady, mapState.mapStyle, pluginState.datasets])

  useEffect(() => {
    if (!mapState.isMapReady) {
      return undefined
    }

    const container = mapProvider.map.getTargetElement()?.closest('.app-map')
    if (!container) {
      return undefined
    }

    if (appState.openPanels?.[INFO_PANEL_ID]) {
      container.classList.add(INFO_PANEL_OPEN_CLASS)
    } else {
      container.classList.remove(INFO_PANEL_OPEN_CLASS)
    }

    return () => container.classList.remove(INFO_PANEL_OPEN_CLASS)
  }, [mapState.isMapReady, appState.openPanels])

  return null
}
