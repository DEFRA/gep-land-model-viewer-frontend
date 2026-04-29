import esriConfig from '@arcgis/core/config.js'
import InteractiveMap, { EVENTS } from '@defra/interactive-map'
import createEsriProvider from '@defra/interactive-map/providers/esri'
import mapStylesPlugin from '@defra/interactive-map/plugins/map-styles'
import { mapStyles } from './config/map-styles.js'
import { registerGridController } from './plugins/grid/index.js'
import { registerLayersPanel } from './plugins/layers/index.js'
import { registerViewMode, createViewModePlugin } from './plugins/view-mode/index.js'

esriConfig.assetsPath = '/public/arcgis-assets'

const MAP_ID = 'land-map'
const DEFAULT_CENTER = [418700, 385100]
const DEFAULT_ZOOM = 14
const MIN_ZOOM = 5
const MAX_ZOOM = 20

const map = new InteractiveMap(MAP_ID, {
  behaviour: 'inline',
  mapProvider: createEsriProvider(),
  mapStyle: mapStyles[0],
  mapLabel: 'Land model grid viewer',
  center: DEFAULT_CENTER,
  zoom: DEFAULT_ZOOM,
  minZoom: MIN_ZOOM,
  maxZoom: MAX_ZOOM,
  containerHeight: '100%',
  plugins: [
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

map.on(EVENTS.MAP_READY, async ({ map: arcgisMap, view }) => {
  const gridController = registerGridController(map, arcgisMap, view)
  registerViewMode(map, view, { grid: gridController })
  registerLayersPanel(map, arcgisMap, view)
})
