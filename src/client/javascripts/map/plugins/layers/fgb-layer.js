import WebGLVectorLayer from 'ol/layer/WebGLVector.js'
import VectorSource from 'ol/source/Vector.js'
import { bbox } from 'ol/loadingstrategy.js'
import { overviewIdFor } from '../../config/layers.js'
import { createPmtilesLayer } from './pmtiles-layer.js'
import { createCogOverviewLayer } from './cog-layer.js'
import { createFgbLoadController } from './fgb-loader.js'
import { validateStyleConfig, vectorStyleFor } from './style-config.js'

// Datasets state the first zoom that draws. OL hides a layer at its minZoom, so
// step back one to make that level the first that renders.
function exclusiveMinZoomFor (firstZoom) {
  if (firstZoom === undefined) {
    return undefined
  }

  return firstZoom - 1
}

function registerLoadRecovery (map, detailLayer, loadController) {
  const view = map.getView()

  function retryFailedViewport () {
    const size = map.getSize()
    const detailIsVisible = detailLayer.getVisible() && view.getZoom() > detailLayer.getMinZoom()
    if (!size || !detailIsVisible) {
      return
    }

    loadController.retryFailedExtents(view.calculateExtent(size))
  }

  // A failed extent stays counted as loaded, so without this it would stay
  // blank for the whole session. One retry per user action avoids timers
  // and failure loops.
  map.on('moveend', retryFailedViewport)
  detailLayer.on('change:visible', retryFailedViewport)
}

function registerSharedCanvasOpacity (layers, opacity) {
  const canvasOpacity = String(opacity)
  const applyOpacity = (event) => {
    const { style } = event.context.canvas
    if (style.opacity !== canvasOpacity) {
      style.opacity = canvasOpacity
    }
  }

  // Either layer may render alone, so both set opacity on their shared canvas.
  for (const layer of layers) {
    layer.addEventListener('precompose', applyOpacity)
  }
}

/**
 * Creates a FlatGeobuf detail layer and its optional PMTiles or COG overview.
 *
 * @param {object} dataset Dataset definition with an fgb source
 * @param {string} layerId Map layer id for the detail layer
 * @param {import('ol/Map.js').default} map Map that will own the layers
 * @returns {Promise<import('ol/layer/Layer.js').default[]>}
 */
export async function createFlatGeobufLayers (dataset, layerId, map) {
  const { url, styleConfig, attribution, opacity, minZoom, overview } = dataset.source
  const hasCogOverview = overview?.type === 'cog'
  const hasPmtilesOverview = overview?.type === 'pmtiles'
  if (overview && !hasPmtilesOverview && !hasCogOverview) {
    throw new Error(`Dataset ${dataset.id} has unsupported overview type "${overview.type}", only pmtiles and cog are supported`)
  }

  validateStyleConfig(styleConfig, dataset.id, { requireBandValues: hasCogOverview })

  const vectorStyle = vectorStyleFor(styleConfig)
  const source = new VectorSource({
    strategy: bbox,
    attributions: attribution,
    // WebGL has its own render batch and hit buffer; this source is not queried by extent.
    useSpatialIndex: false
  })
  const compositeClassName = hasCogOverview ? `ol-layer ${layerId}-composite` : undefined

  // PMTiles hands over above its last zoom. A COG has no upper zoom, so the
  // dataset controls where detail starts.
  const firstZoom = hasPmtilesOverview ? overview.maxZoom + 1 : minZoom
  const detail = new WebGLVectorLayer({
    properties: { id: layerId },
    source,
    minZoom: exclusiveMinZoomFor(firstZoom),
    style: vectorStyle,
    // Consecutive WebGL layers with the same className share a canvas:
    // https://openlayers.org/en/latest/examples/webgl-layer-swipe.html
    // Opaque detail pixels replace the COG before dataset opacity is applied.
    opacity: hasCogOverview ? 1 : opacity,
    className: compositeClassName
  })

  let layers
  if (!overview) {
    layers = [detail]
  } else if (hasCogOverview) {
    const overviewLayer = await createCogOverviewLayer(overview, overviewIdFor(layerId), {
      styleConfig,
      className: compositeClassName
    })
    registerSharedCanvasOpacity([overviewLayer, detail], opacity ?? 1)
    layers = [overviewLayer, detail]
  } else {
    const overviewLayer = await createPmtilesLayer(overview.url, overviewIdFor(layerId), {
      style: vectorStyle,
      maxZoom: overview.maxZoom,
      opacity
    })
    layers = [detail, overviewLayer]
  }

  const loadController = createFgbLoadController(source, url, detail)
  source.setLoader(loadController.loader)
  registerLoadRecovery(map, detail, loadController)

  return layers
}
