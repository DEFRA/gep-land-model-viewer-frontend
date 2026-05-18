import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { statusCodes } from '../common/constants/status-codes.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()
const dirname = path.dirname(fileURLToPath(import.meta.url))
const STYLE_DIR = path.resolve(dirname, '../../client/data/vts')
const SUPPORTED_STYLES = new Set(['OS_VTS_27700_Outdoor.json', 'OS_VTS_27700_Road.json', 'OS_VTS_27700_Dark.json'])
const CACHE_CONTROL = 'public, max-age=3600'

// Esri's VectorTileLayer resolves relative URLs against the style URL, not origin,
// so `/os/vts` would 404 as a sibling of the style. Rewrite to absolute.
const PROXY_PATH_PREFIX = '/os/vts'

const styleCache = new Map()

export function resetStyleCache () {
  styleCache.clear()
}

async function loadStyleJson (filename) {
  const cached = styleCache.get(filename)
  if (cached !== undefined) {
    return cached
  }
  const contents = await readFile(path.join(STYLE_DIR, filename), 'utf8')
  const parsed = JSON.parse(contents)
  styleCache.set(filename, parsed)
  return parsed
}

function rewriteProxyPaths (styleJson, origin) {
  return JSON.stringify(styleJson, (_key, value) => {
    if (typeof value === 'string' && value.startsWith(PROXY_PATH_PREFIX)) {
      return `${origin}${value}`
    }
    return value
  })
}

function getRequestOrigin (request) {
  const protocol = request.headers['x-forwarded-proto'] || request.server.info.protocol
  const host = request.headers['x-forwarded-host'] || request.info.host
  return `${protocol}://${host}`
}

export const styleRoutes = [
  {
    method: 'GET',
    path: '/map/style/{filename}',
    options: { auth: false },
    async handler (request, h) {
      const { filename } = request.params
      if (!SUPPORTED_STYLES.has(filename)) {
        return h.response('Unknown style').code(statusCodes.notFound)
      }

      let styleJson
      try {
        styleJson = await loadStyleJson(filename)
      } catch (err) {
        logger.error(`Failed to load style file ${filename}: ${err.message}`)
        return h.response('Style file unavailable').code(statusCodes.internalServerError)
      }

      const rewritten = rewriteProxyPaths(styleJson, getRequestOrigin(request))

      return h
        .response(rewritten)
        .type('application/json')
        .header('Cache-Control', CACHE_CONTROL)
    }
  }
]
