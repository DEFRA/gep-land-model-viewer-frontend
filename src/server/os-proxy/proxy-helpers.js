import { config } from '../../config/config.js'
import { createLogger } from '../common/helpers/logging/logger.js'
import { statusCodes } from '../common/constants/status-codes.js'

const logger = createLogger()

const DEFAULT_CACHE_CONTROL = 'no-cache'
const CACHE_CONTROL_HEADER = 'cache-control'

export function getApiKey () {
  return config.get('map.osApiKey')
}

export function getResponseHeaders (res) {
  return {
    contentType: res.headers.get('content-type') || '',
    cacheControl: res.headers.get(CACHE_CONTROL_HEADER) || DEFAULT_CACHE_CONTROL
  }
}

export async function handleBinaryResponse (res, h, path, duration) {
  const { contentType, cacheControl } = getResponseHeaders(res)
  const payload = Buffer.from(await res.arrayBuffer())
  logger.debug(
    `Map proxy binary response: ${path} ${res.status} ${payload.length} bytes (${duration}ms)`
  )
  return h
    .response(payload)
    .type(contentType)
    .header(CACHE_CONTROL_HEADER, cacheControl)
}

export async function handleJsonResponse (res, h, request, rewriteUrls, path, duration) {
  const { contentType, cacheControl } = getResponseHeaders(res)
  const body = await res.text()
  logger.info(
    `Map proxy json response: ${path || '/'} ${res.status} ${body.length} chars (${duration}ms)`
  )
  const protocol =
    request.headers['x-forwarded-proto'] || request.server.info.protocol
  const host = request.headers['x-forwarded-host'] || request.info.host
  const rewritten = rewriteUrls(body, `${protocol}://${host}`)
  return h
    .response(rewritten)
    .type(contentType)
    .header(CACHE_CONTROL_HEADER, cacheControl)
}

export async function handleUpstreamError (res, h, path, duration) {
  logger.warn(
    `Map proxy upstream error: ${path || '/'} returned ${res.status} (${duration}ms)`
  )
  const body = Buffer.from(await res.arrayBuffer())
  return h.response(body).code(res.status)
}

export function handleNetworkError (err, h, path) {
  logger.error(err, `Map proxy error for ${path || '/'}`)
  return h.response('Map tile request failed').code(statusCodes.badGateway)
}

export function createUrlRewriter (upstreamBaseUrl, routePath) {
  const basePath = new URL(upstreamBaseUrl).pathname
  return function (body, host) {
    const proxyBase = `${host}${routePath}`
    try {
      const json = JSON.parse(body, (_key, value) => {
        if (typeof value === 'string' && value.startsWith(upstreamBaseUrl)) {
          const subPath = decodeURIComponent(
            new URL(value).pathname.slice(basePath.length)
          )
          return proxyBase + subPath
        }
        return value
      })
      return JSON.stringify(json)
    } catch {
      return body
    }
  }
}
