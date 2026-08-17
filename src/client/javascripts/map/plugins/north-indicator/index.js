const NORTH_INDICATOR_ID = 'northIndicator'
const RESET_NORTH_LABEL = 'Reset bearing to north'
const RESET_NORTH_DURATION = 300

const COMPASS_SVG = [
  '<polygon points="12,1 7,12 17,12" fill="#d4351c" stroke="none"/>',
  '<polygon points="12,23 7,12 17,12" fill="#cecece" stroke="none"/>'
].join('')

export function createNorthIndicatorPlugin () {
  let initialized = false

  function InitComponent ({ mapState, mapProvider }) {
    if (!mapState.isMapReady || initialized) {
      return null
    }
    initialized = true

    const view = mapProvider.map.getView()
    const icon = mapProvider.map.getTargetElement()
      .closest('.im-o-app')
      ?.querySelector('.im-c-map-button--north-indicator .im-c-icon')
    if (!icon) {
      initialized = false
      return null
    }

    function updateRotation () {
      icon.style.transform = `rotate(${view.getRotation()}rad)`
    }

    view.on('change:rotation', updateRotation)
    updateRotation()

    return null
  }

  return {
    id: NORTH_INDICATOR_ID,
    load: async () => ({
      InitComponent,
      buttons: [{
        id: NORTH_INDICATOR_ID,
        label: RESET_NORTH_LABEL,
        iconSvgContent: COMPASS_SVG,
        onClick: (_e, { mapProvider }) => {
          mapProvider.map.getView().animate({ rotation: 0, duration: RESET_NORTH_DURATION })
        },
        mobile: { slot: 'right-top', showLabel: false, order: 1 },
        tablet: { slot: 'right-top', showLabel: false, order: 1 },
        desktop: { slot: 'right-top', showLabel: false, order: 1 }
      }]
    })
  }
}
