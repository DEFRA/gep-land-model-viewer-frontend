import { useEffect } from 'react'

// MapButton exposes no icon ref, its modifier class comes from the kebab-cased button id.
const ICON_SELECTOR = '.im-c-map-button--gep-north-indicator .im-c-icon'

export function NorthIndicatorInit ({ mapState, mapProvider }) {
  useEffect(() => {
    if (!mapState.isMapReady) {
      return undefined
    }

    const app = mapProvider.map.getTargetElement()?.closest('.im-o-app')
    if (!app) {
      return undefined
    }

    const icon = app.querySelector(ICON_SELECTOR)
    if (!icon) {
      return undefined
    }

    const view = mapProvider.map.getView()
    const updateRotation = () => {
      icon.style.transform = `rotate(${view.getRotation()}rad)`
    }

    view.on('change:rotation', updateRotation)
    updateRotation()

    return () => {
      view.un('change:rotation', updateRotation)
    }
  }, [mapState.isMapReady])

  return null
}
