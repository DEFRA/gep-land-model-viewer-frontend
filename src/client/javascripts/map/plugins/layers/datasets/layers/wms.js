import ImageLayer from 'ol/layer/Image.js'
import ImageWMS from 'ol/source/ImageWMS.js'
import { EPSG_27700 } from '../../constants.js'

const capabilitiesCache = new Map()

export function resetCapabilitiesCache () {
  capabilitiesCache.clear()
}

export async function fetchWmsLayerNames (wmsUrl) {
  if (capabilitiesCache.has(wmsUrl)) {
    return capabilitiesCache.get(wmsUrl)
  }

  try {
    const res = await fetch(`${wmsUrl}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`)
    if (!res.ok) {
      return []
    }

    const text = await res.text()
    const doc = new DOMParser().parseFromString(text, 'text/xml')
    const names = [...doc.querySelectorAll('Layer[queryable="1"] > Name')]
      .map(el => el.textContent)
      .filter(Boolean)

    if (names.length) {
      capabilitiesCache.set(wmsUrl, names)
    }
    return names
  } catch {
    return []
  }
}

/**
 * Creates an image layer for a WMS dataset, discovering the layer names via
 * GetCapabilities when the dataset does not state them.
 *
 * @param {object} dataset Dataset definition with a wms source
 * @param {string} layerId Map layer id
 * @returns {Promise<ImageLayer|null>} Null when no queryable layers were found
 */
export async function createWmsLayer (dataset, layerId) {
  const layerNames = dataset.source.layers?.length
    ? dataset.source.layers
    : await fetchWmsLayerNames(dataset.source.url)

  if (!layerNames.length) {
    return null
  }

  const params = {
    LAYERS: layerNames.join(','),
    FORMAT: 'image/png',
    TRANSPARENT: true,
    CRS: EPSG_27700
  }

  return new ImageLayer({
    properties: { id: layerId, wms: true },
    source: new ImageWMS({
      url: dataset.source.url,
      params,
      attributions: dataset.source.attribution,
      ratio: 1.5,
      crossOrigin: 'anonymous'
    }),
    opacity: dataset.source.opacity ?? 1
  })
}

export function getSourceUrl (source) {
  return source.getUrls?.()?.[0] ?? source.getUrl?.()
}

export function getVisibleWmsLayers (map) {
  return map.getLayers().getArray()
    .filter(layer =>
      layer.get('wms') &&
      layer.getVisible() &&
      layer.getSource()?.getParams()?.LAYERS &&
      getSourceUrl(layer.getSource())
    )
}
