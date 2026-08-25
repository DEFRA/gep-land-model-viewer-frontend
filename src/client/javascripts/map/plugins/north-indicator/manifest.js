import { NorthIndicatorInit } from './NorthIndicatorInit.jsx'

const RESET_NORTH_DURATION = 300

const buttonSlot = {
  slot: 'right-top',
  showLabel: false,
  order: 1
}

export const manifest = {
  InitComponent: NorthIndicatorInit,

  buttons: [{
    id: 'gepNorthIndicator',
    label: 'Reset bearing to north',
    iconId: 'gepCompass',
    onClick: (_e, { mapProvider }) => {
      mapProvider.map.getView().animate({ rotation: 0, duration: RESET_NORTH_DURATION })
    },
    mobile: buttonSlot,
    tablet: buttonSlot,
    desktop: buttonSlot
  }],

  icons: [{
    id: 'gepCompass',
    svgContent: [
      '<polygon points="12,1 7,12 17,12" fill="#d4351c" stroke="none"/>',
      '<polygon points="12,23 7,12 17,12" fill="#cecece" stroke="none"/>'
    ].join('')
  }]
}
