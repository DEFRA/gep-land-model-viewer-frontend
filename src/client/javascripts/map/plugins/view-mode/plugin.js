import { VIEW_MODE_BUTTON_ID, VIEW_MODE_CONTENT_ID, VIEW_MODE_DEFAULT, VIEW_MODE_PANEL_ID } from './constants.js'
import { renderViewModePanelHtml, MODE_LABELS } from './render.js'

export function createViewModeButtonConfig (mode = VIEW_MODE_DEFAULT) {
  return {
    id: VIEW_MODE_BUTTON_ID,
    label: MODE_LABELS[mode],
    panelId: VIEW_MODE_PANEL_ID,
    mobile: { slot: 'right-top', showLabel: true, order: 1 },
    tablet: { slot: 'right-top', showLabel: true, order: 1 },
    desktop: { slot: 'right-top', showLabel: true, order: 1 }
  }
}

export default function createViewModePlugin () {
  return {
    id: 'gepViewMode',
    load: async () => ({
      buttons: [createViewModeButtonConfig()],
      panels: [{
        id: VIEW_MODE_PANEL_ID,
        label: 'Map view mode',
        html: `<div id="${VIEW_MODE_CONTENT_ID}">${renderViewModePanelHtml(VIEW_MODE_DEFAULT)}</div>`,
        mobile: { slot: 'drawer', open: false, modal: true, dismissible: true, showLabel: false },
        tablet: { slot: `${VIEW_MODE_BUTTON_ID}-button`, open: false, modal: true, width: '180px', dismissible: false, showLabel: false },
        desktop: { slot: `${VIEW_MODE_BUTTON_ID}-button`, open: false, modal: true, width: '180px', dismissible: false, showLabel: false }
      }]
    })
  }
}
