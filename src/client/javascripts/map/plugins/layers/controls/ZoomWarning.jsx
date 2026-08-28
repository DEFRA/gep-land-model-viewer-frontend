import { useEffect } from 'react'
import { InlineIcon } from '../../../components/InlineIcon.jsx'
import { ZOOM_IN_ICON } from '../icons.js'
import { SUMMARY_TOGGLES } from '../summaries/options.js'

function zoomWarningMessage (entries, zoom) {
  const belowZoom = entries.filter(entry => zoom < entry.minZoom)
  if (!belowZoom.length) {
    return ''
  }

  if (belowZoom.length === 1) {
    return `Zoom in to see ${belowZoom[0].label}`
  }

  return 'Zoom in to see the selected data layers'
}

function warningEntries (datasets, { datasets: datasetStates, summaries }) {
  return [
    ...SUMMARY_TOGGLES
      .filter(toggle => summaries[toggle.id])
      .map(({ label, minZoom }) => ({ label, minZoom })),
    ...datasets
      .filter(dataset => datasetStates[dataset.id]?.visible && datasetStates[dataset.id]?.minZoom !== undefined)
      .map(dataset => ({ label: dataset.label, minZoom: datasetStates[dataset.id].minZoom }))
  ]
}

export function ZoomWarning ({ mapState, pluginConfig, pluginState, services }) {
  const zoomMessage = zoomWarningMessage(
    warningEntries(pluginConfig.datasets, pluginState),
    mapState.zoom
  )

  useEffect(() => {
    if (zoomMessage) {
      services.announce(zoomMessage)
    }
  }, [zoomMessage])

  if (!zoomMessage) {
    return null
  }

  return (
    <div className='app-map__zoom-warning'>
      <InlineIcon className='app-map__zoom-warning-icon' content={ZOOM_IN_ICON} />
      <span>{zoomMessage}</span>
    </div>
  )
}
