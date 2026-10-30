import { createLogger } from '../logging/logger.js'
import { getJson, getManifest } from './client.js'

const logger = createLogger()

/**
 * @typedef {string | { [key: string]: AssetFiles }} AssetFiles A filename, or asset files grouped by key
 * @typedef {string | { [key: string]: AssetUrls }} AssetUrls An asset URL, or asset URLs grouped by key
 */

/**
 * @typedef {object} LayerResponse
 * @property {string | null} manifestVersion S3 version ID of manifest.json, null when unavailable
 * @property {string} generatedAt When the pipeline published the release
 * @property {object} styleConfig The release's style.json
 * @property {Record<string, { name?: string, date?: string | null }>} [dataSources] The release's data sources by theme, when the manifest has them
 * @property {Record<string, AssetUrls>} assets Asset URLs, with a version parameter when the manifest supplies one
 */

/**
 * @param {string} path
 * @param {string | null} version S3 version ID from the manifest
 * @returns {string}
 */
function assetUrl (path, version) {
  return version === null ? path : `${path}?${new URLSearchParams({ v: version })}`
}

/**
 * @param {Record<string, AssetFiles>} assetFiles
 * @param {Record<string, string | null>} files File versions from the manifest
 * @param {string} assetsPath URL path of the layer's asset route
 * @returns {Record<string, AssetUrls>} URLs of the assets the manifest lists
 */
function assetUrls (assetFiles, files, assetsPath) {
  return Object.fromEntries(Object.entries(assetFiles)
    .filter(([, file]) => typeof file !== 'string' || Object.hasOwn(files, file))
    .map(([type, file]) => [
      type,
      typeof file === 'string' ? assetUrl(`${assetsPath}/${file}`, files[file]) : assetUrls(file, files, assetsPath)
    ]))
}

/**
 * @param {string} prefix Object key prefix of the layer's files
 * @param {Record<string, AssetFiles>} assetFiles Asset filenames by type
 * @param {string} assetsPath URL path of the layer's asset route
 * @param {Record<string, string>} [jsonFiles] Further JSON files to return by key, read at their manifest versions
 * @returns {Promise<(LayerResponse & Record<string, unknown>) | null>} null when the prefix has no manifest
 */
export async function getLayer (prefix, assetFiles, assetsPath, jsonFiles = {}) {
  logger.debug({ prefix }, 'Loading layer release')
  const release = await getManifest(prefix)
  if (!release) {
    logger.debug({ prefix }, 'Layer release not found')
    return null
  }

  const { manifestVersion, generatedAt, files, dataSources } = release
  const [styleConfig, json] = await Promise.all([
    getJson(prefix, 'style.json', files['style.json']),
    Promise.all(Object.entries(jsonFiles).map(async ([key, filename]) => [key, await getJson(prefix, filename, files[filename])]))
  ])

  logger.debug({ prefix }, 'Layer release loaded')
  return {
    manifestVersion,
    generatedAt,
    styleConfig,
    ...(dataSources ? { dataSources } : {}),
    ...Object.fromEntries(json),
    assets: assetUrls(assetFiles, files, assetsPath)
  }
}
