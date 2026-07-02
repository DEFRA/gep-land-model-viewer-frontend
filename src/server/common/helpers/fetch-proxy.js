import { createLogger } from './logging/logger.js'
import { statusCodes } from '../constants/status-codes.js'

const logger = createLogger()

const CACHE_CONTROL_HEADER = 'cache-control'
const CONTENT_TYPE_HEADER = 'content-type'
const VALIDATOR_HEADERS = ['etag', 'last-modified']
const CONDITIONAL_HEADERS = ['if-none-match', 'if-modified-since']

export function getConditionalHeaders (request) {
  const headers = {}
  for (const name of CONDITIONAL_HEADERS) {
    if (request.headers[name]) {
      headers[name] = request.headers[name]
    }
  }
  return headers
}

function applyValidatorHeaders (response, res) {
  for (const name of VALIDATOR_HEADERS) {
    const value = res.headers.get(name)
    if (value) {
      response.header(name, value)
    }
  }
  return response
}

export function handleNotModifiedResponse (res, h, path, duration) {
  logger.debug(`Map proxy not modified: ${path || '/'} (${duration}ms)`)
  const response = h.response().code(statusCodes.notModified)
  return applyValidatorHeaders(response, res)
}

export async function handleBinaryResponse (res, h, path, duration) {
  // OS sends validators but no cache-control on tiles.
  const cacheControl = res.headers.get(CACHE_CONTROL_HEADER) || 'private, max-age=86400'
  const contentType = res.headers.get(CONTENT_TYPE_HEADER) || ''
  const payload = Buffer.from(await res.arrayBuffer())
  logger.debug(
    `Map proxy binary response: ${path} ${res.status} ${payload.length} bytes (${duration}ms)`
  )
  const response = h
    .response(payload)
    .type(contentType)
    .header(CACHE_CONTROL_HEADER, cacheControl)
  return applyValidatorHeaders(response, res)
}

export async function handleJsonResponse (res, h, request, rewriteUrls, path, duration) {
  const contentType = res.headers.get(CONTENT_TYPE_HEADER) || ''
  // Rewritten styles carry no validators, so force a refetch on reuse.
  const cacheControl = res.headers.get(CACHE_CONTROL_HEADER) || 'no-cache'
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
