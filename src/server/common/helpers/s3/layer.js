import { getJson, getManifest } from './client.js'

/**
 * @typedef {object} LayerResponse
 * @property {string | null} manifestVersion S3 version ID of manifest.json, null when unavailable
 * @property {string} generatedAt When the pipeline published the release
 * @property {object} styleConfig The release's style.json
 * @property {Record<string, string>} assets Asset URLs, with a version parameter when the manifest supplies one
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
 * @param {string} prefix Object key prefix of the layer's files
 * @param {Record<string, string>} assetFiles Asset filenames by type
 * @param {string} assetsPath URL path of the layer's asset route
 * @returns {Promise<LayerResponse | null>} null when the prefix has no manifest
 */
export async function getLayer (prefix, assetFiles, assetsPath) {
  const release = await getManifest(prefix)
  if (!release) {
    return null
  }

  const { manifestVersion, generatedAt, files } = release
  const styleConfig = await getJson(prefix, 'style.json', files['style.json'])
  const assets = Object.fromEntries(Object.entries(assetFiles)
    .filter(([, filename]) => Object.hasOwn(files, filename))
    .map(([type, filename]) => [type, assetUrl(`${assetsPath}/${filename}`, files[filename])]))

  return { manifestVersion, generatedAt, styleConfig, assets }
}
