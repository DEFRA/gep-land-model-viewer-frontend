const FGB_MIN_ZOOM = 7
export const DEFAULT_OPACITY = 0.5

/**
 * The data URL and default display settings for a dataset.
 *
 * @typedef {object} DatasetSource
 * @property {'cog' | 'fgb' | 'wms'} type Data format or service type
 * @property {string} url Data asset URL or WMS service URL
 * @property {number} [opacity] Default layer opacity from 0 to 1
 * @property {{ themes: object[] }} [styleConfig] Themed styles for COG and FlatGeobuf sources
 * @property {number} [minZoom] First visible zoom level for FlatGeobuf detail
 * @property {{ type: 'cog', url: string }} [overview] COG underlay for a FlatGeobuf source
 * @property {string[]} [layers] WMS layer names. Fetched from capabilities when omitted or empty
 * @property {string} [attribution] Credit displayed while the dataset is visible
 */

/**
 * Builds a source from the dataset's style config and available data assets.
 * @param {{ themes: object[] }} styleConfig Original themed style config
 * @param {{ fgb?: string, cog?: string }} assets Available data asset URLs
 * @returns {DatasetSource}
 */
export function sourceFor (styleConfig, assets) {
  if (!styleConfig) {
    throw new Error('Missing style config')
  }

  if (!styleConfig.themes?.length) {
    throw new Error('Missing style themes')
  }

  const source = { opacity: DEFAULT_OPACITY, styleConfig }

  if (assets.fgb) {
    return { ...source, type: 'fgb', url: assets.fgb, minZoom: FGB_MIN_ZOOM, overview: assets.cog && { type: 'cog', url: assets.cog } }
  }

  if (assets.cog) {
    return { ...source, type: 'cog', url: assets.cog }
  }

  throw new Error('Missing map data')
}
