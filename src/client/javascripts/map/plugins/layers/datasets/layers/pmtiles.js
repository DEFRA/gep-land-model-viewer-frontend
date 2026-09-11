import { PMTiles } from 'pmtiles'
import VectorTileLayer from 'ol/layer/VectorTile.js'
import VectorTileSource from 'ol/source/VectorTile.js'
import MVT from 'ol/format/MVT.js'
import TileState from 'ol/TileState.js'
import { buildVectorStyle } from '../style-config.js'

// PMTiles overviews are supplied in Web Mercator.
const EPSG_3857 = 'EPSG:3857'

/**
 * Builds an overview layer for a Web Mercator PMTiles archive of MVT tiles.
 *
 * @param {string} url PMTiles archive URL
 * @param {string} layerId Map layer id
 * @param {object} options
 * @param {object} options.styleConfig Style config
 * @param {number} options.maxZoom Last map zoom the overview renders at
 * @param {number} options.opacity
 * @returns Dataset layer for the vector tile overview
 */
export async function createPmtilesLayer (url, layerId, { styleConfig, maxZoom, opacity }) {
  const archive = new PMTiles(url)
  const header = await archive.getHeader()
  const format = new MVT()

  const source = new VectorTileSource({
    projection: EPSG_3857,
    format,
    wrapX: false,
    minZoom: header.minZoom,
    maxZoom: header.maxZoom,
    tileUrlFunction: ([z, x, y]) => `${z}/${x}/${y}`,
    tileLoadFunction: (tile, tileUrl) => {
      const vectorTile = /** @type {import('ol/VectorTile.js').default} */ (tile)
      const [z, x, y] = tileUrl.split('/').map(Number)
      vectorTile.setLoader((extent, _resolution, projection) => {
        archive.getZxy(z, x, y)
          .then((result) => {
            // An address missing from the archive is an empty tile, not a failure
            const features = result?.data
              ? format.readFeatures(result.data, { extent, featureProjection: projection })
              : []
            vectorTile.setFeatures(features)
          })
          .catch(() => {
            vectorTile.setState(TileState.ERROR)
          })
      })
    }
  })

  const layer = new VectorTileLayer({
    properties: { id: layerId },
    source,
    style: buildVectorStyle(styleConfig),
    maxZoom,
    opacity
  })

  return {
    layers: [layer],
    applyStyle: next => layer.setStyle(buildVectorStyle(next)),
    setOpacity: next => layer.setOpacity(next)
  }
}
