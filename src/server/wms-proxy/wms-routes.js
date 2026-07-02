import { createLogger } from '../common/helpers/logging/logger.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { config } from '../../config/config.js'
import {
  getConditionalHeaders,
  handleBinaryResponse,
  handleNotModifiedResponse,
  handleUpstreamError,
  handleNetworkError
} from '../common/helpers/fetch-proxy.js'

const logger = createLogger()

const WMS_ROUTE_PATH = '/wms'

const WMS_SERVICES = {
  apgb: 'map.apgbUrl'
}

function getServiceUrl (service) {
  const configKey = WMS_SERVICES[service]
  if (!configKey) {
    return { error: 'Unknown WMS service', code: statusCodes.notFound }
  }

  const baseUrl = config.get(configKey)
  if (!baseUrl) {
    return { error: `WMS service '${service}' is not configured`, code: statusCodes.badGateway }
  }

  return { baseUrl }
}

const wmsProxyHandler = {
  method: 'GET',
  path: `${WMS_ROUTE_PATH}/{service}`,
  options: { tags: ['api'] },
  async handler (request, h) {
    const { service } = request.params

    const result = getServiceUrl(service)
    if (result.error) {
      logger.warn(`WMS proxy: ${result.error}`)
      return h
        .response({ error: result.error })
        .code(result.code)
    }

    const params = new URLSearchParams(request.query)
    const url = `${result.baseUrl}?${params.toString()}`

    try {
      const startTime = Date.now()
      const res = await fetch(url, { redirect: 'follow', headers: getConditionalHeaders(request) })
      const duration = Date.now() - startTime

      logger.debug(`WMS proxy request: ${service} (${duration}ms)`)

      if (res.status === statusCodes.notModified) {
        return handleNotModifiedResponse(res, h, service, duration)
      }

      if (!res.ok) {
        return handleUpstreamError(res, h, service, duration)
      }

      return handleBinaryResponse(res, h, service, duration)
    } catch (err) {
      return handleNetworkError(err, h, service)
    }
  }
}

export { WMS_ROUTE_PATH }
export default [wmsProxyHandler]
