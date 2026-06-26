import { createLogger } from '../common/helpers/logging/logger.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { getApiKey } from './proxy-helpers.js'

const logger = createLogger()

const OS_NAMES_API_URL = 'https://api.os.uk/search/names/v1/find'
const DEFAULT_CACHE_CONTROL = 'no-cache'
const CACHE_CONTROL_HEADER = 'cache-control'
const MAX_QUERY_LENGTH = 200

export const NAMES_ROUTE_PATH = '/os/names/find'

function buildUpstreamUrl (query) {
  const osApiKey = getApiKey()
  const params = new URLSearchParams()
  params.set('query', query)
  params.set('key', osApiKey)
  return `${OS_NAMES_API_URL}?${params.toString()}`
}

const namesSearchHandler = {
  method: 'GET',
  path: NAMES_ROUTE_PATH,
  options: { tags: ['api'] },
  async handler (request, h) {
    const query = request.query.query
    if (!query?.trim()) {
      return h
        .response({ error: 'Missing required query parameter' })
        .code(statusCodes.badRequest)
    }

    if (query.length > MAX_QUERY_LENGTH) {
      return h
        .response({ error: 'Query parameter exceeds maximum length' })
        .code(statusCodes.badRequest)
    }

    try {
      const upstreamUrl = buildUpstreamUrl(query.trim())
      const startTime = Date.now()
      const res = await fetch(upstreamUrl, { redirect: 'follow' })
      const duration = Date.now() - startTime

      if (!res.ok) {
        logger.warn(
          `OS Names proxy upstream error: returned ${res.status} (${duration}ms)`
        )
        const errorBody = await res.text()
        return h.response(errorBody).code(res.status)
      }

      const cacheControl =
        res.headers.get(CACHE_CONTROL_HEADER) || DEFAULT_CACHE_CONTROL
      const body = await res.text()

      logger.info(
        `OS Names proxy response: ${res.status} ${body.length} chars (${duration}ms)`
      )

      return h
        .response(body)
        .type('application/json')
        .header(CACHE_CONTROL_HEADER, cacheControl)
    } catch (err) {
      logger.error(err, 'OS Names proxy network error')
      return h
        .response({ error: 'Search request failed' })
        .code(statusCodes.badGateway)
    }
  }
}

export default [namesSearchHandler]
