import { renderInfoLinksPanelHtml } from './render.js'

const INFO_LINKS_ID = 'gepInfoLinks'

// Lucide "info"
const INFO_SVG = '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'

export function createInfoLinksPlugin () {
  return {
    id: INFO_LINKS_ID,
    load: async () => ({
      buttons: [{
        id: INFO_LINKS_ID,
        label: 'Page information',
        iconSvgContent: INFO_SVG,
        panelId: INFO_LINKS_ID,
        mobile: { slot: 'right-bottom', showLabel: false, order: 1 },
        tablet: { slot: 'right-bottom', showLabel: false, order: 1 },
        desktop: { slot: 'right-bottom', showLabel: false, order: 1 }
      }],
      panels: [{
        id: INFO_LINKS_ID,
        label: 'Page information',
        html: renderInfoLinksPanelHtml(),
        mobile: { slot: 'drawer', open: false, modal: true, dismissible: true, showLabel: false },
        tablet: { slot: `${INFO_LINKS_ID}-button`, open: false, modal: true, width: '340px', dismissible: false, showLabel: false },
        desktop: { slot: `${INFO_LINKS_ID}-button`, open: false, modal: true, width: '340px', dismissible: false, showLabel: false }
      }]
    })
  }
}
