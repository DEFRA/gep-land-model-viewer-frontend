import InfoIcon from '@lucide/icons/icons/info'
import { lucideIconContent } from '../../lucide-icon-content.js'
import { InfoLinks } from './InfoLinks.jsx'

const PANEL_LABEL = 'Page information'

const buttonSlot = {
  slot: 'right-bottom',
  showLabel: false,
  order: 1
}

const panelSlot = {
  slot: 'gep-info-links-button',
  open: false,
  modal: true,
  width: '340px',
  dismissible: false,
  showLabel: false
}

export const manifest = {
  buttons: [{
    id: 'gepInfoLinks',
    label: PANEL_LABEL,
    panelId: 'gepInfoLinks',
    iconId: 'gepInfo',
    mobile: buttonSlot,
    tablet: buttonSlot,
    desktop: buttonSlot
  }],

  panels: [{
    id: 'gepInfoLinks',
    label: PANEL_LABEL,
    mobile: {
      slot: 'drawer',
      open: false,
      modal: true,
      dismissible: true,
      showLabel: false
    },
    tablet: panelSlot,
    desktop: panelSlot,
    render: InfoLinks
  }],

  icons: [{
    id: 'gepInfo',
    svgContent: lucideIconContent(InfoIcon)
  }]
}
