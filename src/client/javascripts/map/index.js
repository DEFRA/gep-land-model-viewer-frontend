import InteractiveMap, { EVENTS } from '@defra/interactive-map'
import DoubleClickZoom from 'ol/interaction/DoubleClickZoom.js'
import createOpenLayersProvider from '@defra/interactive-map/providers/openlayers'
import mapStylesPlugin from '@defra/interactive-map/plugins/map-styles'
import searchPlugin from '@defra/interactive-map/plugins/search'
import { mapStyles } from './config/map-styles.js'
import { registerFeatureController } from './plugins/feature/index.js'
import { registerGridController } from './plugins/grid/index.js'
import { registerInfoPanel } from './plugins/info-panel/index.js'
import { registerLayersPanel } from './plugins/layers/index.js'
import { createDatasetHitSource } from './plugins/layers/dataset-hits.js'
import { createInfoLinksPlugin } from './plugins/info-links/index.js'
import { createNorthIndicatorPlugin } from './plugins/north-indicator/index.js'

const MAP_ID = 'land-map'
const DEFAULT_CENTER = [465000, 475000] // center of sample land model area
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
      placeholder: 'Search for a location...',
      regions: ['england'],
      width: '300px',
      manifest: {
        controls: [{
          id: 'search',
          mobile: { slot: 'top-left', showLabel: false, order: 2 },
          tablet: { slot: 'top-left', showLabel: true, order: 2 },
          desktop: { slot: 'top-left', showLabel: true, order: 2 }
        }]
      }
    }),
    mapStylesPlugin({
      mapStyles,
      manifest: {
        buttons: [{
          id: 'mapStyles',
          mobile: { slot: 'right-top', showLabel: false, order: 4 },
          tablet: { slot: 'right-top', showLabel: false, order: 4 },
          desktop: { slot: 'right-top', showLabel: false, order: 4 }
        }],
        panels: [{
          id: 'mapStyles',
          mobile: { slot: 'drawer', modal: true, dismissible: true },
          tablet: { slot: 'map-styles-button', width: '340px', modal: true, dismissible: true },
          desktop: { slot: 'map-styles-button', width: '340px', modal: true, dismissible: true }
        }]
      }
    }),
    createNorthIndicatorPlugin(),
    createInfoLinksPlugin()
  ]
})

map.on(EVENTS.MAP_READY, (/** @type {{ map: import('ol/Map').default, mapStyleId: string }} */ { map: olMap, mapStyleId }) => {
  // Disable intermediary zoom levels for better rendering quality
  olMap.getView().setConstrainResolution(true)

  // The provider registers its interactions with double-click zoom off.
  olMap.addInteraction(new DoubleClickZoom())

  const infoPanel = registerInfoPanel(map, olMap)
  infoPanel.activate(createDatasetHitSource(olMap))
  const grid = registerGridController(map, olMap, infoPanel)
  const features = registerFeatureController(map, olMap, mapStyleId, infoPanel)
  registerLayersPanel(map, olMap, mapStyleId, infoPanel, { grid, features })
})
