import { useEffect } from 'react'
import { ZoomIn } from 'lucide-preact'
import { SUMMARIES } from '../summaries/config.js'

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

function warningEntries (datasets, pluginState) {
  const entries = []

  for (const layer of pluginState.layers) {
    if (layer.hidden || !layer.ready) {
      continue
    }

    const summary = SUMMARIES.find(candidate => candidate.id === layer.id)
    if (summary) {
      entries.push({ label: summary.label, minZoom: summary.minZoom })
    } else {
      const dataset = datasets.find(candidate => candidate.id === layer.id)
      if (dataset && layer.minZoom !== undefined) {
        entries.push({ label: dataset.label, minZoom: layer.minZoom })
      }
    }
  }

  return entries
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
      <ZoomIn className='app-map__zoom-warning-icon' />
      <span>{zoomMessage}</span>
    </div>
  )
}
