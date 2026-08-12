import WebGLVectorLayer from 'ol/layer/WebGLVector.js'
import VectorSource from 'ol/source/Vector.js'
import { bbox } from 'ol/loadingstrategy.js'
import { createLoader } from 'flatgeobuf/lib/mjs/ol.js'
import { overviewIdFor } from '../../config/layers.js'
import { EPSG_27700 } from './constants.js'
import { loadLyrxStyle } from './lyrx-style.js'
import { createPmtilesLayer } from './pmtiles-layer.js'

// Datasets state the first zoom that draws. OL hides a layer at its minZoom, so
// step back one to make that level the first that renders.
function exclusiveMinZoomFor (firstZoom) {
  if (firstZoom === undefined) {
    return undefined
  }

  return firstZoom - 1
}

/**
 * Creates the layers for a FlatGeobuf dataset: a WebGL vector detail layer,
 * plus an overview layer when the source supplies one.
 *
 * @param {object} dataset Dataset definition with an fgb source
 * @param {string} layerId Map layer id for the detail layer
 * @returns {Promise<import('ol/layer/Layer.js').default[]>}
 */
export async function createFlatGeobufLayers (dataset, layerId) {
  const { url, styleUrl, attribution, opacity, lowercaseFields = false, style: manualStyle, minZoom, overview } = dataset.source
  if (overview && overview.type !== 'pmtiles') {
    throw new Error(`Dataset ${dataset.id} has unsupported overview type "${overview.type}", only pmtiles is supported`)
  }

  const { style, maxResolution } = styleUrl ? await loadLyrxStyle(styleUrl, { lowercaseFields }) : {}
  const source = new VectorSource({ strategy: bbox, attributions: attribution })

  source.setLoader(createLoader(source, url, EPSG_27700, bbox))

  // An overview or a configured minZoom overrides the layer file's minScale, and
  // an overview hands the detail layer the zoom after its own last zoom level.
  const useLayerFileMinScale = !overview && minZoom === undefined
  const firstZoom = overview ? overview.maxZoom + 1 : minZoom
  const detail = new WebGLVectorLayer({
    properties: { id: layerId },
    source,
    maxResolution: useLayerFileMinScale ? maxResolution : undefined,
    minZoom: exclusiveMinZoomFor(firstZoom),
    style: manualStyle ?? style,
    opacity
  })

  if (!overview) {
    return [detail]
  }

  const overviewLayer = await createPmtilesLayer(overview.url, overviewIdFor(layerId), {
    style: manualStyle ?? style,
    maxZoom: overview.maxZoom,
    opacity
  })

  return [detail, overviewLayer]
}
