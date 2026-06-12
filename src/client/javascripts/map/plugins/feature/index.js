import { EVENTS } from '@defra/interactive-map'
import { OS_NGD_TILESET_URL, OS_NGD_STYLE_IDS } from '../../config/map-styles.js'
import { FEATURE_VISIBLE_MIN_ZOOM } from './constants.js'
import { createFeatureLayer } from './feature-layer.js'
import { createInspectController } from '../info-panel/controller.js'
import { getFeatureDetails } from './data.js'
import { renderEmptyStateHtml, renderFeatureInfoHtml } from './render.js'

/**
 * @param {import('@defra/interactive-map').default} interactiveMap
 * @param {import('ol/Map').default} map
 * @param {string} initialStyleId The map style active at registration.
 * @param {ReturnType<import('../info-panel/index.js').registerInfoPanel>} infoPanel
 */
export function registerFeatureController (interactiveMap, map, initialStyleId, infoPanel) {
  const featureLayer = createFeatureLayer(map, OS_NGD_TILESET_URL)
  featureLayer.refreshSource(OS_NGD_STYLE_IDS.includes(initialStyleId))

  const inspector = {
    emptyHtml: renderEmptyStateHtml(),

    hitTest (coords) {
      const pixel = map.getPixelFromCoordinate(coords)
      const hit = featureLayer.findFeatureAtPixel(pixel)
      if (hit) {
        featureLayer.selectFeature(hit.osid)
      }
      return hit
    },

    loadDetails (hit) {
      return getFeatureDetails(hit.osid)
    },

    renderHtml (hit, details) {
      return renderFeatureInfoHtml({
        osid: hit.osid,
        description: details.description ?? hit.description
      })
    },

    clearSelection () {
      featureLayer.clearSelection()
    }
  }

  // Style change replaces the basemap layer and source
  interactiveMap.on(EVENTS.MAP_STYLE_CHANGE, ({ mapStyleId }) => {
    featureLayer.refreshSource(OS_NGD_STYLE_IDS.includes(mapStyleId))
  })

  return createInspectController(map, {
    minZoom: FEATURE_VISIBLE_MIN_ZOOM,
    layer: featureLayer,
    cursorClass: 'app-map--feature',
    inspector,
    infoPanel
  })
}
