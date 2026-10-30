import WebGLVectorLayer from 'ol/layer/WebGLVector.js'
import VectorSource from 'ol/source/Vector.js'
import { bbox } from 'ol/loadingstrategy.js'
import { magicbytes } from 'flatgeobuf/lib/mjs/constants.js'
import { overviewIdFor } from '../../../../config/layers.js'
import { createCogOverviewLayer } from './cog.js'
import { createFgbLoadController } from './fgb-loader.js'
import { buildColourVariables, buildVectorStyleWithVariables, hasOutlineOnlyClass } from '../style-config.js'

async function checkFgbSignature (url) {
  const response = await fetch(url, { headers: { Range: 'bytes=0-7' } })
  if (!response.ok) {
    throw new Error(`Failed to load FlatGeobuf: ${response.status}`)
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  // FGB starts with an eight-byte signature, the 8th byte is the backwards compatible patch version so can be ignored
  // https://flatgeobuf.org/#specification
  const signature = magicbytes.subarray(0, 7)
  if (bytes.length !== magicbytes.length || !signature.every((byte, index) => bytes[index] === byte)) {
    throw new Error('Invalid FlatGeobuf signature')
  }
}

// Sources state the first zoom that draws. OL hides a layer at its minZoom, so
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

function registerSharedCanvasOpacity (layers, initialOpacity) {
  let canvasOpacity = String(initialOpacity)
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

  return (opacity) => {
    const next = String(opacity)
    if (next === canvasOpacity) {
      return
    }

    canvasOpacity = next
    for (const layer of layers) {
      layer.changed()
    }
  }
}

/**
 * Creates a FlatGeobuf detail layer and its optional COG overview.
 *
 * @param {object} layerConfig Layer config with an fgb source
 * @param {string} layerId Map layer id for the detail layer
 * @param {import('ol/Map.js').default} map Map that will own the layers
 * @param {object} presentation Resolved layer style and opacity
 * @returns Map layers containing the detail layer and optional overview
 */
export async function createFlatGeobufLayer (layerConfig, layerId, map, { styleConfig, opacity }) {
  const { url, minZoom, overview } = layerConfig.source
  await checkFgbSignature(url)

  let themeBand = styleConfig.band

  const { style, variables } = buildVectorStyleWithVariables(styleConfig)
  const source = new VectorSource({
    strategy: bbox,
    // WebGL has its own render batch and hit buffer, but it skips transparent
    // fills, so outline-only classes are hit tested by coordinate instead.
    useSpatialIndex: hasOutlineOnlyClass(layerConfig.source.styleConfig.themes)
  })
  const compositeClassName = overview ? `ol-layer ${layerId}-composite` : undefined

  const detail = new WebGLVectorLayer({
    properties: { id: layerId },
    source,
    minZoom: exclusiveMinZoomFor(minZoom),
    style,
    variables,
    // Consecutive WebGL layers with the same className share a canvas:
    // https://openlayers.org/en/latest/examples/webgl-layer-swipe.html
    // Opaque detail pixels replace the COG before layer opacity is applied.
    opacity: overview ? 1 : opacity,
    className: compositeClassName
  })

  let layers
  let overviewLayer
  if (overview) {
    overviewLayer = await createCogOverviewLayer(overview, overviewIdFor(layerId), {
      styleConfig,
      className: compositeClassName
    })
    layers = [...overviewLayer.layers, detail]
  } else {
    layers = [detail]
  }

  const loadController = createFgbLoadController(source, url, detail, styleConfig.field)
  source.setLoader(loadController.loader)
  registerLoadRecovery(map, detail, loadController)

  return {
    layers,
    applyStyle (next) {
      if (next.band === themeBand) {
        detail.updateStyleVariables(buildColourVariables(next))
      } else {
        const { style: nextStyle, variables: nextVariables } = buildVectorStyleWithVariables(next)
        detail.updateStyleVariables(nextVariables)
        detail.setStyle(nextStyle)
        themeBand = next.band
        loadController.setStyleField(next.field)
      }
      overviewLayer?.applyStyle(next)
    },
    setOpacity: overview
      ? registerSharedCanvasOpacity(layers, opacity)
      : (next) => detail.setOpacity(next)
  }
}
