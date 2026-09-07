import LayersIcon from '@lucide/icons/icons/layers'
import ListIcon from '@lucide/icons/icons/list'
import { lucideIconContent } from '../../lucide-icon-content.js'
import { initialState, actions, INSPECTION_STATUS } from './reducer.js'
import { LayersInit } from './LayersInit.jsx'
import { LayersPanel } from './panels/layers/LayersPanel.jsx'
import { KeyPanel } from './panels/key/KeyPanel.jsx'
import { ContentsPanel } from './panels/contents/ContentsPanel.jsx'
import { InfoPanel } from './panels/info/InfoPanel.jsx'
import { ZoomWarning } from './controls/ZoomWarning.jsx'
import { CONTENTS_PANEL_ID, INFO_PANEL_ID } from './constants.js'

function infoPanelTitle ({ status, hits, hit }) {
  if (hit) {
    return hit.panelTitle ?? hit.label
  }

  if (status === INSPECTION_STATUS.LIST) {
    return `${hits.length} layers selected`
  }

  if (status === INSPECTION_STATUS.SEARCHING) {
    return 'Loading details'
  }

  if (status === INSPECTION_STATUS.EMPTY) {
    return 'No information found'
  }

  return undefined
}

const topLeftButton = {
  slot: 'top-left',
  showLabel: true
}

const sidePanel = {
  slot: 'side',
  open: false,
  modal: false,
  width: '320px',
  dismissible: true,
  showLabel: false
}

const drawerPanel = {
  slot: 'drawer',
  open: false,
  modal: true,
  dismissible: true
}

const bannerSlot = {
  slot: 'banner'
}

const keyPanel = {
  slot: 'left-top',
  open: false,
  modal: false,
  width: '450px',
  dismissible: true
}

const infoPanel = {
  slot: 'right-top',
  open: false,
  modal: false,
  width: 'var(--app-map-info-panel-width)',
  dismissible: true
}

const contentsPanel = {
  slot: 'gep-contents-button',
  open: false,
  modal: false,
  width: 'var(--app-map-contents-panel-width)',
  dismissible: true
}

export const manifest = {
  InitComponent: LayersInit,

  reducer: {
    initialState,
    actions
  },

  buttons: [{
    id: 'gepLayers',
    label: 'Layers',
    panelId: 'gepLayers',
    iconId: 'gepLayersIcon',
    enableWhen: ({ mapState }) => mapState.isMapReady,
    // Hide the button while its panel is open.
    hiddenWhen: ({ appState }) => Boolean(appState.openPanels?.gepLayers),
    mobile: { ...topLeftButton, showLabel: false, order: 1 },
    tablet: { ...topLeftButton, order: 1 },
    desktop: { ...topLeftButton, order: 1 }
  }, {
    id: 'gepKey',
    label: 'Key',
    panelId: 'gepKey',
    iconId: 'gepKeyIcon',
    enableWhen: ({ mapState }) => mapState.isMapReady,
    mobile: { ...topLeftButton, showLabel: false, order: 3 },
    tablet: { ...topLeftButton, order: 3 },
    desktop: { ...topLeftButton, order: 3 }
  }, {
    id: CONTENTS_PANEL_ID,
    label: 'Contents',
    panelId: CONTENTS_PANEL_ID,
    enableWhen: ({ mapState }) => mapState.isMapReady,
    mobile: { slot: 'right-top', showLabel: true, order: 1 },
    tablet: { slot: 'right-top', showLabel: true, order: 1 },
    desktop: { slot: 'right-top', showLabel: true, order: 1 }
  }],

  panels: [{
    id: 'gepLayers',
    label: 'Layers',
    mobile: { ...drawerPanel, showLabel: false },
    tablet: { ...drawerPanel, showLabel: false },
    desktop: sidePanel,
    render: LayersPanel
  }, {
    id: 'gepKey',
    label: 'Key',
    mobile: drawerPanel,
    tablet: keyPanel,
    desktop: keyPanel,
    render: KeyPanel
  }, {
    id: CONTENTS_PANEL_ID,
    label: 'Contents',
    mobile: drawerPanel,
    tablet: contentsPanel,
    desktop: contentsPanel,
    render: ContentsPanel
  }, {
    id: INFO_PANEL_ID,
    label: ({ pluginState }) => infoPanelTitle(pluginState.inspection),
    mobile: drawerPanel,
    tablet: drawerPanel,
    desktop: infoPanel,
    render: InfoPanel
  }],

  controls: [{
    id: 'gepZoomWarning',
    label: 'Layer visibility warning',
    mobile: bannerSlot,
    tablet: bannerSlot,
    desktop: bannerSlot,
    render: ZoomWarning
  }],

  icons: [{
    id: 'gepLayersIcon',
    svgContent: lucideIconContent(LayersIcon)
  }, {
    id: 'gepKeyIcon',
    svgContent: lucideIconContent(ListIcon)
  }]
}
