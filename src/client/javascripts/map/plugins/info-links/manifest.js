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
    // Lucide "info"
    id: 'gepInfo',
    svgContent: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'
  }]
}
