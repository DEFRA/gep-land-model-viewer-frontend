import InteractiveMap, { EVENTS } from '@defra/interactive-map'
import createOpenLayersProvider from '@defra/interactive-map/providers/openlayers'
import mapStylesPlugin from '@defra/interactive-map/plugins/map-styles'
import searchPlugin from '@defra/interactive-map/plugins/search'
import { mapStyles } from './config/map-styles.js'
import { registerFeatureController } from './plugins/feature/index.js'
import { registerGridController } from './plugins/grid/index.js'
import { registerInfoPanel } from './plugins/info-panel/index.js'
import { registerLayersPanel } from './plugins/layers/index.js'
import { createViewModePlugin, registerViewMode } from './plugins/view-mode/index.js'

const MAP_ID = 'land-map'
const DEFAULT_CENTER = [418700, 385100]
const DEFAULT_ZOOM = 7
const MIN_ZOOM = 0
const MAX_ZOOM = 13

const map = new InteractiveMap(MAP_ID, {
  behaviour: 'inline',
  mapProvider: createOpenLayersProvider({ zoomAlignment: 'uk' }),
  mapStyle: mapStyles[0],
  mapLabel: 'Land model grid viewer',
  center: DEFAULT_CENTER,
  zoom: DEFAULT_ZOOM,
  minZoom: MIN_ZOOM,
  maxZoom: MAX_ZOOM,
  containerHeight: '100%',
  plugins: [
    searchPlugin({
      osNamesURL: '/os/names/find?query={query}',
      showMarker: true,
      regions: ['england'],
      width: '300px',
      manifest: {
        controls: [{
          id: 'search',
          mobile: { slot: 'top-left', showLabel: false, order: 2 },
          tablet: { slot: 'top-left', showLabel: false, order: 2 },
          desktop: { slot: 'top-left', showLabel: false, order: 2 }
        }]
      }
    }),
    mapStylesPlugin({
      mapStyles,
      manifest: {
        buttons: [{
          id: 'mapStyles',
          mobile: { slot: 'right-top', showLabel: false },
          tablet: { slot: 'right-top', showLabel: false },
          desktop: { slot: 'right-top', showLabel: false }
        }],
        panels: [{
          id: 'mapStyles',
          mobile: { slot: 'drawer', modal: true, dismissible: true },
          tablet: { slot: 'mapStyles-button', width: '280px', modal: true, dismissible: true },
          desktop: { slot: 'mapStyles-button', width: '280px', modal: true, dismissible: true }
        }]
      }
    }),
    createViewModePlugin()
  ]
})

map.on(EVENTS.MAP_READY, (/** @type {{ map: import('ol/Map').default, mapStyleId: string }} */ { map: olMap, mapStyleId }) => {
  // Disable intermediary zoom levels for better rendering quality
  olMap.getView().setConstrainResolution(true)

  registerLayersPanel(map, olMap)
  const infoPanel = registerInfoPanel(map, olMap)
  const grid = registerGridController(map, olMap, infoPanel)
  const feature = registerFeatureController(map, olMap, mapStyleId, infoPanel)
  registerViewMode(map, olMap, { grid, feature })
})
