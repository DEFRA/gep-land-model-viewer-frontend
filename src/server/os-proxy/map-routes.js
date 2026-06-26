import { createLogger } from '../common/helpers/logging/logger.js'
import { statusCodes } from '../common/constants/status-codes.js'
import {
  getApiKey,
  getConditionalHeaders,
  handleBinaryResponse,
  handleJsonResponse,
  handleNotModifiedResponse,
  handleUpstreamError,
  handleNetworkError,
  createUrlRewriter
} from './proxy-helpers.js'

const logger = createLogger()

const OS_VTS_BASE_URL = 'https://api.os.uk/maps/vector/v1/vts'
const OS_NGD_BASE_URL = 'https://api.os.uk/maps/vector/ngd/ota/v1'
const OS_RASTER_BASE_URL = 'https://api.os.uk/maps/raster/v1/zxy'
const VTS_ROUTE_PATH = '/os/vts'
const NGD_ROUTE_PATH = '/os/ngd'
const RASTER_ROUTE_PATH = '/os/raster'

const rewriteVtsUrls = createUrlRewriter(OS_VTS_BASE_URL, VTS_ROUTE_PATH)
const rewriteNgdUrls = createUrlRewriter(OS_NGD_BASE_URL, NGD_ROUTE_PATH)

function getVtsUpstreamUrl (path, query) {
  const apiKey = getApiKey()
  const params = new URLSearchParams(query)
  params.set('key', apiKey)
  params.set('srs', '27700')
  const base = path
    ? `${OS_VTS_BASE_URL}/${path}`
    : OS_VTS_BASE_URL
  return `${base}?${params.toString()}`
}

function isVtsBinaryPath (path) {
  return path.endsWith('.pbf') || path.endsWith('.png') || path.endsWith('.jpg')
}

const vtsProxyHandler = {
  method: 'GET',
  path: `${VTS_ROUTE_PATH}/{path*}`,
  options: { tags: ['api'] },
  async handler (request, h) {
    const path = request.params.path || ''

    try {
      const url = getVtsUpstreamUrl(path, request.query)
      const isBinaryResource = isVtsBinaryPath(path)
      const logLevel = isBinaryResource ? 'debug' : 'info'
      logger[logLevel](
        `Map proxy ${isBinaryResource ? 'binary' : 'json'} request: ${path || '/'}`
      )
      const startTime = Date.now()
      const res = await fetch(url, { redirect: 'follow', headers: getConditionalHeaders(request) })
      const duration = Date.now() - startTime

      if (res.status === statusCodes.notModified) {
        return handleNotModifiedResponse(res, h, path, duration)
      }

      if (!res.ok) {
        return handleUpstreamError(res, h, path, duration)
      }

      return isBinaryResource
        ? handleBinaryResponse(res, h, path, duration)
        : handleJsonResponse(res, h, request, rewriteVtsUrls, path, duration)
    } catch (err) {
      return handleNetworkError(err, h, path)
    }
  }
}

function getNgdUpstreamUrl (path, query) {
  const apiKey = getApiKey()
  const params = new URLSearchParams(query)
  params.set('key', apiKey)
  const base = path
    ? `${OS_NGD_BASE_URL}/${path}`
    : OS_NGD_BASE_URL
  return `${base}?${params.toString()}`
}

function isJsonContentType (contentType) {
  return contentType.includes('json') || contentType.includes('text')
}

const ngdProxyHandler = {
  method: 'GET',
  path: `${NGD_ROUTE_PATH}/{path*}`,
  options: { tags: ['api'] },
  async handler (request, h) {
    const path = request.params.path || ''

    try {
      const url = getNgdUpstreamUrl(path, request.query)
      const startTime = Date.now()
      const res = await fetch(url, { redirect: 'follow', headers: getConditionalHeaders(request) })
      const duration = Date.now() - startTime

      if (res.status === statusCodes.notModified) {
        return handleNotModifiedResponse(res, h, path, duration)
      }

      const contentType = res.headers.get('content-type') || ''
      const isBinaryResource = !isJsonContentType(contentType)
      const logLevel = isBinaryResource ? 'debug' : 'info'
      logger[logLevel](
        `Map proxy ${isBinaryResource ? 'binary' : 'json'} request: ${path || '/'}`
      )

      if (!res.ok) {
        return handleUpstreamError(res, h, path, duration)
      }

      return isBinaryResource
        ? handleBinaryResponse(res, h, path, duration)
        : handleJsonResponse(res, h, request, rewriteNgdUrls, path, duration)
    } catch (err) {
      return handleNetworkError(err, h, path)
    }
  }
}

const rasterProxyHandler = {
  method: 'GET',
  path: `${RASTER_ROUTE_PATH}/{path*}`,
  options: { tags: ['api'] },
  async handler (request, h) {
    const path = request.params.path || ''
    const apiKey = getApiKey()
    const url = `${OS_RASTER_BASE_URL}/${path}?key=${apiKey}`

    try {
      const startTime = Date.now()
      const res = await fetch(url, { redirect: 'follow', headers: getConditionalHeaders(request) })
      const duration = Date.now() - startTime

      if (res.status === statusCodes.notModified) {
        return handleNotModifiedResponse(res, h, path, duration)
      }

      if (!res.ok) {
        return handleUpstreamError(res, h, path, duration)
      }

      return handleBinaryResponse(res, h, path, duration)
    } catch (err) {
      return handleNetworkError(err, h, path)
    }
  }
}

export default [vtsProxyHandler, ngdProxyHandler, rasterProxyHandler]
