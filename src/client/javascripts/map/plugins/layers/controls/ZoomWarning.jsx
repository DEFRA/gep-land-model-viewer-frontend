import { useEffect } from 'react'
import { ZoomIn } from 'lucide-preact'
import { SUMMARIES } from '../summaries/config.js'

const ZOOM_IN_DURATION = 300

function zoomWarningMessage (belowZoom) {
  if (!belowZoom.length) {
    return ''
  }

  if (belowZoom.length === 1) {
    return `Zoom in to see ${belowZoom[0].label}`
  }

  return 'Zoom in to see the selected data layers'
}

function warningEntries (pluginState) {
  const entries = []

  for (const layer of pluginState.layers) {
    if (layer.hidden || !layer.ready) {
      continue
    }

    const summary = SUMMARIES.find(candidate => candidate.id === layer.id)
    const entry = summary ? { label: summary.label, minZoom: summary.minZoom } : { label: layer.title, minZoom: layer.minZoom }
    if (entry.minZoom !== undefined) {
      entries.push(entry)
    }
  }

  return entries
}

export function ZoomWarning ({ mapState, pluginState, mapProvider, services }) {
  const belowZoom = warningEntries(pluginState).filter(entry => mapState.zoom < entry.minZoom)
  const zoomMessage = zoomWarningMessage(belowZoom)

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
      <button
        type='button'
        className='app-map__zoom-warning-button'
        aria-label='Zoom in'
        onClick={() => mapProvider.map.getView().animate({ zoom: Math.max(...belowZoom.map(entry => entry.minZoom)), duration: ZOOM_IN_DURATION })}
      >
        <ZoomIn className='app-map__zoom-warning-icon' aria-hidden='true' />
      </button>
      <span>{zoomMessage}</span>
    </div>
  )
}
